/** The smartphone: the primary management interface. Every button does something. */
import { CONFIG, DAY_NAMES } from '../core/config.js';
import { money, hhmm, dayOf, minuteOfDay, duration, clamp } from '../core/util.js';
import { clock, inventoryList, countItem, pushMessage, hasItem, unreadMessages } from '../core/state.js';
import { bump } from '../core/state.js';
import { billInfo, payBill, setAutopay, buyFood, applyForCRP, recertCRP, claimUtilityGrant, listItem, cancelListing, buyGrabBag, GROCERY } from '../systems/economy.js';
import { eat, useSubstance, sleep, soberUp } from '../systems/needs.js';
import { shiftInfo, doOddJob, oddJobsAvailable, applyForJob, quitJob, callOut, workShift } from '../systems/jobs.js';
import { fellowshipStage, serviceWindow } from '../systems/fellowship.js';
import { el, esc as _esc, chance, pick, clamp as _clamp } from '../core/util.js';
import { portraitURL } from '../render/faces.js';
import { kindForName } from './threads.js';
import { THEMES, SCALES, themeLabel } from './themes.js';
import { APPS, HOME_GRID, DOCK, appIcon, serviceAvatar } from './apps.js';
import { itemIcon } from './icons.js';
import * as dealer from '../systems/dealer.js';
import * as life from '../systems/life.js';
import * as dating from '../systems/dating.js';
import * as social from '../systems/social.js';
import * as block from '../systems/block.js';
import * as casino from '../systems/casino.js';
import { postImage } from './feedart.js';
import { installSites, siteActions, stoopPostBody } from './sites.js';
import * as sms from '../systems/sms.js';

/** One thread per contact: "RAE", "RAE VELL" and "RAE VELL (LANDLORD)" are the same person. */
const threadKeyOf = (m) => String(sms.identityFor(m.from).name || m.from || '').toUpperCase();
import * as rent from '../systems/rent.js';
import * as romance from '../systems/romance.js';
import * as clinic from '../systems/clinic.js';
import { ENDINGS } from '../systems/endings.js';
import { partnerWhereabouts, PARTNER_SCHEDULES, PARTNER_AREA_NAMES } from '../world/schedules.js';

const DEFAULT_REPLIES = [
  "ok",
  "yeah. i know.",
  "can we not do this right now",
  "i'll call you later",
];

const T = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Phone {
  constructor(root, game) {
    this.root = root;
    this.g = game;
    this.wrap = null;
    this.app = 'home';
    this.msgId = null;
    this.bidItem = null;
    this.bidPrice = null;
    this.log = [];
  }

  get isOpen() { return !!this.wrap; }

  toggle(appId = null) {
    if (this.wrap) this.close();
    else this.open(appId);
  }

  open(appId = null) {
    if (this.wrap) return;
    // LoveLine is a tab of FeedLove now; anything that still asks for it lands there
    if (appId === 'dates') { appId = 'social'; this.feedTab = 'love'; }
    this.app = appId || 'home';
    this.wrap = el(`<div class="phone-wrap"><div class="phone">
      <span class="phone__side phone__side--1"></span>
      <span class="phone__side phone__side--2"></span>
      <div class="phone__shell">
        <div class="phone__speaker"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="phone__screen">
          <div class="phone__bar">
            <span class="phone__sig"><i></i><i></i><i></i></span>
            <span data-live="clock">--:--</span>
            <span class="spacer"></span>
            <span class="phone__carrier">SHALE</span>
            <span data-live="money">$0</span>
          </div>
          <div class="phone__body"></div>
          <div class="phone__nav phone__nav--gesture">
            <button data-nav="home" class="phone__homebar" aria-label="Home"><i></i></button>
            <button data-nav="close" class="phone__x" aria-label="Put the phone away">×</button>
          </div>
        </div>
        <div class="phone__chin"><i></i></div>
      </div>
    </div></div>`);
    this.body = this.wrap.querySelector('.phone__body');
    this.wrap.addEventListener('click', (e) => this.onClick(e));
    // sliders apply as they are dragged; re-rendering here would drop the handle mid-drag
    this.wrap.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-act]');
      if (!input) return;
      const fn = this.actions[input.dataset.act];
      if (!fn) return;
      fn.call(this, input.dataset.arg, undefined, input);
      this.syncLive();
      // settings are part of the saved state; debounce so a drag is one write, not sixty
      if (input.dataset.act.startsWith('cam')) {
        clearTimeout(this.camSaveTimer);
        this.camSaveTimer = setTimeout(() => this.g.autosave?.(), 500);
      }
    });
    this.wrap.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT' || e.target.type === 'range') return;
      if (e.key === 'Escape') { e.target.blur(); return; }
      e.stopPropagation();
      // Enter sends whatever box it is in
      const send = { feedtext: 'posttyped', stooptext: 'stooppost', boardtext: 'boardpost' }[e.target.id];
      if (e.key === 'Enter' && send) {
        e.preventDefault();
        const btn = this.body.querySelector(`[data-act="${send}"]`);
        this.actions[send].call(this, btn?.dataset.arg);
        this.render();
      }
    });
    this.root.appendChild(this.wrap);
    this.render();
    this.g.audio?.sfx?.('phone');
    this.g.onPhoneOpenChange?.(true);
  }

  close() {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.g.audio?.sfx?.('ui-back');
    this.g.onPhoneOpenChange?.(false);
  }

  onClick(e) {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const id = nav.dataset.nav;
      if (id === 'close') return this.close();
      this.app = id;
      this.msgId = null;
      this.g.audio.sfx('ui');
      return this.render();
    }
    const action = e.target.closest('[data-act]');
    if (!action) return;
    if (action.tagName === 'INPUT') { return; } // sliders are handled by the input listener
    const act = action.dataset.act;
    const arg = action.dataset.arg;
    const num = action.dataset.num !== undefined ? Number(action.dataset.num) : undefined;
    const fn = this.actions[act];
    if (!fn) { console.warn('[phone] no action', act); return; }
    this.g.audio.sfx('ui');
    fn.call(this, arg, num, action);
    if (act.startsWith('cam')) this.g.autosave?.();
    if (this.wrap) this.render();
  }

  render() {
    if (!this.wrap) return;
    const s = this.g.state;
    const c = clock(s);
    this.wrap.querySelector('[data-live="clock"]').textContent = `${c.hhmm} · D${c.day}`;
    this.wrap.querySelector('[data-live="money"]').textContent = money(s.money);
    const view = this.apps[this.app] ? this.apps[this.app].call(this) : this.homeView();
    const sameView = this.lastView === `${this.app}|${this.feedTab}`;
    const keep = this.body.scrollTop;
    const draft = this.body.querySelector('#feedtext')?.value;
    this.body.innerHTML = view;
    this.body.dataset.app = this.app;
    this.wrap.querySelector('.phone__screen').dataset.app = this.app;
    this.body.scrollTop = this.app === 'dealer' ? this.body.scrollHeight : sameView ? keep : 0;
    if (draft && this.body.querySelector('#feedtext')) this.body.querySelector('#feedtext').value = draft;
    this.lastView = `${this.app}|${this.feedTab}`;
  }

  /** Live read-outs under sliders, updated while dragging. */
  syncLive() {
    if (!this.wrap) return;
    const s = this.g.state.settings;
    const set = (key, value) => {
      const node = this.wrap.querySelector(`[data-live="${key}"]`);
      if (node) node.textContent = value;
    };
    if (s.camDist !== undefined) set('camdist', `${Math.round(s.camDist * 100)}%`);
    if (s.camHeight !== undefined) set('camheight', `${Math.round(s.camHeight * 100)}%`);
    if (s.volume !== undefined) set('musicvol', `${Math.round(s.volume * 100)}%`);
    if (s.sfxVolume !== undefined) set('sfxvol', `${Math.round(s.sfxVolume * 100)}%`);
  }

  /**
   * Every app wears its own brand: the parody name and tagline from the catalog, its icon, and
   * its colours as --a/--b, which the per-app stylesheet builds the rest of the look from.
   */
  header(title, kicker = '') {
    const brand = APPS[this.app];
    if (!brand) {
      return `<div class="papp">
        <div class="app__header">
          <button class="app__back" data-nav="home">◀</button>
          <span class="app__title">${T(title)}</span>
          ${kicker ? `<span class="spacer"></span><span class="tiny mono-dim">${T(kicker)}</span>` : ''}
        </div>
        <div class="app__body">`;
    }
    const sub = title && title !== brand.name ? title : brand.tag;
    return `<div class="papp papp--${this.app}" style="--a:${brand.a};--b:${brand.b}">
      <div class="app__header app__header--brand">
        <button class="app__back" data-nav="home" aria-label="Home">‹</button>
        ${appIcon(this.app, { ...this.iconCtx(), label: false })}
        <span class="app__brand"><b class="app__logo">${T(brand.name)}</b><em>${T(sub)}</em></span>
        ${kicker ? `<span class="app__kick">${T(kicker)}</span>` : ''}
      </div>
      <div class="app__body">`;
  }

  iconCtx() {
    const s = this.g.state;
    const day = dayOf(s.clock.m);
    return { day, weekday: DAY_NAMES[(day - 1) % 7].slice(0, 3).toUpperCase() };
  }
  footer() { return '</div></div>'; }

  /* ------------------------------ HOME ------------------------------ */

  homeView() {
    const s = this.g.state;
    const rent = billInfo(this.g, 'rent');
    const badges = {
      messages: unreadMessages(s),
      bidbay: s.listings.length,
      pantry: s.crp.suspended ? 1 : 0,
      bills: rent.owedCycles > 0 ? rent.owedCycles : 0,
      fellowship: s.fellowship.stage > 0 && s.fellowship.stage < 5 ? 1 : 0,
      rolo: dealer.dealerState(s).unread || (dealer.activeOrder(s)?.status === 'waiting' ? 1 : 0),
    };
    const ctx = this.iconCtx();
    const c = clock(s);
    const mood = this.g.hud?.mood || { id: 'content', label: 'CONTENT', note: '' };
    const fit = s.stats.energy > 55 ? 'Roughly' : s.stats.energy > 25 ? 'Barely' : 'No';
    return `<div class="mohome">
      <div class="mohome__lock">
        <span class="mohome__time">${c.hhmm}</span>
        <span class="mohome__date">${DAY_NAMES[(ctx.day - 1) % 7]} · Day ${ctx.day}</span>
      </div>
      <div class="mohome__widgets">
        <div class="widget widget--mo">
          <img src="${portraitURL('mo', mood.id)}" alt="" />
          <div><b>${T(mood.label)}</b><em>${T(mood.note || 'holding')}</em></div>
        </div>
        <div class="widget widget--next">
          <em>Up next</em><b>${T(this.nextObligation())}</b>
          <span>Fit for the day: ${fit}</span>
        </div>
      </div>
      <div class="mohome__grid">${HOME_GRID.map((id) => appIcon(id, { ...ctx, badge: badges[id] || 0 })).join('')}</div>
      <div class="mohome__signal">${s.flags.phoneLate ? 'Shale Mobile · signal degraded (bill overdue)' : 'Shale Mobile · weak but honest'}</div>
      <div class="mohome__dock">${DOCK.map((id) => appIcon(id, { ...ctx, badge: badges[id] || 0, label: false })).join('')}</div>
    </div>`;
  }

  nextObligation() {
    const g = this.g;
    const rent = billInfo(g, 'rent');
    const shift = shiftInfo(g);
    if (shift.today && !shift.worked) return `Shift ${String(Math.floor(shift.start / 60)).padStart(2, '0')}:00`;
    if (rent.owedCycles > 0) return `Rent overdue`;
    if (rent.daysLeft <= 3) return `Rent in ${rent.daysLeft}d`;
    return 'Nothing today';
  }

  /* ------------------------------ BANK ------------------------------ */

  bankView() {
    const s = this.g.state;
    const rent = billInfo(this.g, 'rent');
    const power = billInfo(this.g, 'power');
    const phone = billInfo(this.g, 'phone');
    const bills = [rent, power, phone].map((b) => `
      <div class="listitem">
        <div class="grow">
          <div class="name">${T(b.name)}</div>
          <div class="meta">${b.owedCycles > 0 ? `<span class="bad">${b.owedCycles} cycle${b.owedCycles > 1 ? 's' : ''} overdue · ${money(b.owed)}</span>` : `Due Day ${b.nextDueDay} · ${money(b.base)}`}</div>
        </div>
        <button class="btn btn--sm" data-act="pay" data-arg="${b.key}" ${b.owedCycles <= 0 || s.money < b.owed ? 'disabled' : ''}>PAY</button>
      </div>`).join('');

    return `${this.header('Shale Pay', 'DEBIT')}
      <div class="bankcard ${s.money < 30 ? 'bankcard--low' : ''}">
        <span class="bankcard__chip"></span>
        <span class="bankcard__brand">SHALE<b>PAY</b></span>
        <span class="bankcard__label">Available balance</span>
        <span class="bankcard__bal">${money(s.money)}</span>
        <span class="bankcard__num">•••• •••• •••• 03B0</span>
        <span class="bankcard__name">MO · UNIT 3B</span>
      </div>
      <div class="tiny mono-dim">Overdraft: none. Bank policy: "we are not a charity, we are a bank" — the difference is marketing.</div>
      ${this.debtCard()}
      ${this.rentAheadCard()}
      <div class="card autopay">
        <div class="grow"><b>AutoPay</b><div class="tiny mono-dim">${s.autopay?.on ? 'On: rent, power and phone are paid the day they are due, if the money is there. You get a text either way.' : 'Off: you pay each bill yourself.'}</div></div>
        <button class="toggle ${s.autopay?.on ? 'on' : ''}" data-act="autopay" aria-label="AutoPay"><i></i></button>
      </div>
      <div class="app__h">Bills</div>
      <div class="list">${bills}</div>
      <div class="app__h">Recent activity</div>
      <div class="list">
        ${s.ledger.slice(-8).reverse().map((l) => `
          <div class="kv"><span class="tiny">D${l.day} · ${T(l.label)}</span><b class="${l.amount < 0 ? 'debtv' : 'creditv'}">${l.amount < 0 ? '-' : '+'}${money(Math.abs(l.amount))}</b></div>`).join('') || '<div class="empty">No transactions. No evidence. No comfort.</div>'}
      </div>
      ${this.footer()}`;
  }

  /* ------------------------------ JOBS ------------------------------ */

  jobsView() {
    const g = this.g;
    const s = g.state;
    const info = shiftInfo(g);
    const jobs = oddJobsAvailable(g);
    const stateLabel = {
      off: 'Not a shift day.', before: 'Too early.', 'on-time': 'Shift starting — clock in.', late: 'You are late.', 'almost-over': 'Shift almost gone.', missed: 'Shift missed.', done: 'Shift complete.',
    }[info.state] || '';
    return `${this.header('LinkedOut', 'CASH TODAY')}
      <div class="profile">
        <span class="profile__ring"><img src="${portraitURL('mo', this.g.hud?.mood?.id || 'content')}" alt="" /></span>
        <div><b>Mo</b><em>${s.job.employed ? `${T(s.job.title)} at ${T(s.job.employer)}` : 'Between opportunities'}</em><span class="profile__open">#OpenToWork</span></div>
      </div>
      <div class="card">
        <div class="kv"><span>Employer</span><b>${s.job.employed ? T(s.job.employer) : 'None'}</b></div>
        <div class="kv"><span>Position</span><b>${s.job.employed ? T(s.job.title) : '—'}</b></div>
        <div class="kv"><span>Wage</span><b>${money(s.job.wage)}/hr</b></div>
        <div class="kv"><span>Strikes</span><b class="${s.job.strikes > 0 ? 'bad' : ''}">${s.job.strikes}/${CONFIG.job.maxStrikes}</b></div>
        <div class="kv"><span>Today</span><b>${stateLabel}</b></div>
      </div>
      <div class="row row--wrap">
        <button class="btn btn--primary" data-act="work" ${info.canClockIn && g.world?.areaId === 'street' ? '' : 'disabled'}>CLOCK IN</button>
        <button class="btn" data-act="callout" ${info.today && !info.worked ? '' : 'disabled'}>CALL OUT</button>
        ${s.job.employed ? '<button class="btn btn--danger" data-act="quit">QUIT</button>' : `<button class="btn btn--gold" data-act="rehire">ASK FOR REHIRE</button>`}
      </div>
      <div class="tiny mono-dim">${info.canClockIn && g.world?.areaId !== 'street' ? 'You must be at Quik-Stop to clock in. (Walk right from your door.)' : 'Shift 09:00–17:00, Mon–Fri. Clock in at the store, or here if you are on the street.'}</div>
      <div class="app__h">Odd jobs — today</div>
      <div class="list">
        ${jobs.length ? jobs.map((j) => `
          <div class="listitem">
            <div class="grow">
              <div class="name">${T(j.name)}</div>
              <div class="meta">${j.hours}h · ${T(j.blurb)} · needs ${j.minEnergy} energy</div>
            </div>
            <button class="btn btn--sm" data-act="oddjob" data-arg="${j.id}" ${s.stats.energy < j.minEnergy ? 'disabled' : ''}>+${money(j.pay)}</button>
          </div>`).join('') : '<div class="empty">Board is empty. Even the board has given up.</div>'}
      </div>
      <div class="tiny mono-dim">Accepting a job from here includes 20 minutes of walking there.</div>
      ${this.footer()}`;
  }

  /* ------------------------------ BIDBAY ------------------------------ */

  bidbayView() {
    const g = this.g;
    const s = g.state;
    const sellable = inventoryList(s).filter((i) => i.def.kind !== 'doc');
    const listings = s.listings;
    if (this.bidItem) {
      const def = CONFIG.items[this.bidItem];
      const price = this.bidPrice ?? def.value;
      return `${this.header('List an item', 'BIDBAY')}
        <div class="card">
          <div class="row row--between"><span>${T(def.name)}</span><b class="creditv">${money(price)}</b></div>
          <div class="tiny mono-dim">Suggested market value: ${money(def.value)}. Price above 135% of value and nobody bites.</div>
        </div>
        <input type="range" min="${Math.max(1, Math.round(def.value * 0.3))}" max="${Math.round(def.value * 2)}" value="${price}" step="1" data-act="bidprice" data-arg="${this.bidItem}" style="width:100%" />
        <div class="row row--between tiny mono-dim"><span>30%</span><span>200%</span></div>
        <div class="row">
          <button class="btn btn--primary" data-act="bidconfirm" data-arg="${this.bidItem}">LIST IT</button>
          <button class="btn btn--ghost" data-act="bidcancel">BACK</button>
        </div>
        ${this.footer()}`;
    }
    return `${this.header('BidBay', `${s.counters.unitsSold} SOLD`)}
      <div class="card">
        <div class="row row--between"><span class="tiny mono-dim">Active listings</span><b>${listings.length}</b></div>
        <div class="tiny mono-dim">Buyers browse at night. Listings resolve on their own schedule, like everything else.</div>
      </div>
      <div class="list">
        ${listings.map((l) => `
          <div class="listitem">
            <div class="grow">
              <div class="name">${T(l.name)} — ${money(l.price)}</div>
              <div class="meta">live · resolves ${hhmm(l.resolveAt)}</div>
            </div>
            <button class="btn btn--sm" data-act="cancelbid" data-arg="${l.id}">PULL</button>
          </div>`).join('') || '<div class="empty">Nothing listed. Your apartment is technically inventory.</div>'}
      </div>
      <div class="app__h">Sell something</div>
      <div class="list">
        ${sellable.length ? sellable.map((i) => `
          <div class="listitem">
            <div class="grow">
              <div class="name">${T(i.def.name)} ${i.qty > 1 ? `x${i.qty}` : ''}</div>
              <div class="meta">${i.def.kind} · value ${money(i.def.value ?? i.def.price ?? 0)}</div>
            </div>
            <button class="btn btn--sm" data-act="bidpick" data-arg="${i.id}">LIST</button>
          </div>`).join('') : '<div class="empty">Nothing to sell. You have achieved minimalism through attrition.</div>'}
      </div>
      <div class="app__h">BidBay mystery box</div>
      <div class="listitem">
        <div class="grow"><div class="name">Grab Bag — ${money(CONFIG.items.grab_bag.price)}</div><div class="meta">random resale goods · ~30 min delivery</div></div>
        <button class="btn btn--sm" data-act="grabbag" ${s.money < CONFIG.items.grab_bag.price ? 'disabled' : ''}>BUY</button>
      </div>
      ${this.footer()}`;
  }

  /* ------------------------------ PANTRY ------------------------------ */

  pantryView() {
    const g = this.g;
    const s = g.state;
    const crp = s.crp;
    return `${this.header('GrubHope', crp.active ? `CREDIT ${money(crp.credit)}` : 'CASH')}
      <div class="promo"><b>Delivery: never.</b><span>Pickup: you. Groceries land in your pocket instantly, because the plot needs them to.</span></div>
      <div class="card">
        <div class="kv"><span class="tiny mono-dim">FOOD CREDIT</span><b class="${crp.suspended ? 'bad' : 'creditv'}">${money(crp.credit)}</b></div>
        <div class="kv"><span class="tiny mono-dim">CASH</span><b>${money(s.money)}</b></div>
        <div class="tiny mono-dim">${crp.active ? (crp.suspended ? 'CREDIT SUSPENDED — recertification required.' : `Recertify every ${CONFIG.economy.crp.recertDays} days at no cost.`) : 'Not enrolled. Groceries cost cash until you enroll at the Civic Relief Program.'}</div>
      </div>
      <div class="app__h">Groceries</div>
      <div class="list">
        ${GROCERY.map((id) => {
          const def = CONFIG.items[id];
          const cost = def.price;
          return `<div class="listitem listitem--food">
            ${itemIcon(id)}
            <div class="grow"><div class="name">${T(def.name)}</div><div class="meta">+${def.hunger} hunger · ${money(cost)} · have ${countItem(s, id)}</div></div>
            <button class="btn btn--sm" data-act="buyfood" data-arg="${id}" ${s.money < cost ? 'disabled' : ''}>CASH</button>
            <button class="btn btn--sm btn--gold" data-act="buycredit" data-arg="${id}" ${!crp.active || crp.suspended || crp.credit < cost ? 'disabled' : ''}>CRP</button>
          </div>`;
        }).join('')}
      </div>
      <div class="app__h">Relief programs</div>
      <div class="list">
        <div class="listitem">
          <div class="grow"><div class="name">Civic Relief Program</div><div class="meta">${crp.active ? `enrolled · next recert day ${(crp.lastRecert || 0) + CONFIG.economy.crp.recertDays}` : 'requires ID + lease · 45 min'}</div></div>
          ${crp.active
            ? `<button class="btn btn--sm" data-act="recert">RECERTIFY</button>`
            : `<button class="btn btn--sm" data-act="applycrp" ${hasItem(s, 'id_card') && hasItem(s, 'lease') ? '' : 'disabled'}>APPLY</button>`}
        </div>
        <div class="listitem">
          <div class="grow"><div class="name">Emergency Utility Relief</div><div class="meta">one-time · requires an overdue power bill</div></div>
          <button class="btn btn--sm" data-act="utility" ${crp.utilityGrant ? 'disabled' : ''}>APPLY</button>
        </div>
      </div>
      ${this.footer()}`;
  }

  /* ------------------------------ MESSAGES ------------------------------ */

  messagesView() {
    const s = this.g.state;
    if (this.msgId) {
      // one conversation per person: every text from them, oldest first, with Mo's replies in place
      const key = this.msgId;
      const msgs = s.messages.filter((x) => threadKeyOf(x) === key).reverse();
      if (!msgs.length) { this.msgId = null; return this.messagesView(); }
      const last = msgs[msgs.length - 1];
      const face = this.senderFace(last.from);
      const mo = `<img class="chat__face" src="${portraitURL('mo', this.g.hud?.mood?.id || 'content')}" alt="" />`;
      let day = null;
      const bubbles = msgs.map((m) => {
        m.read = true;
        const sep = m.day !== day ? `<div class="chat__day">DAY ${m.day}</div>` : '';
        day = m.day;
        return sep + `<div class="chat__row">${face}<div class="chat__bubble chat__bubble--in">${T(m.body)}</div></div>`
          + (m.replies || []).map((r) => `<div class="chat__row chat__row--out"><div class="chat__bubble chat__bubble--out">${T(r.text)}</div>${mo}</div>`).join('');
      }).join('');
      const opts = sms.replyOptions(last, s);
      const quick = opts.length ? opts.map((o) => o.label) : ['Leave it.'];
      return `${this.header(last.from, `${msgs.length} message${msgs.length === 1 ? '' : 's'}`)}
        <div class="chat">${bubbles}</div>
        <div class="chat__quick">
          ${quick.map((q, i) => `<button class="chat__chip" data-act="reply" data-arg="${last.id}" data-num="${i}">${T(q)}</button>`).join('')}
        </div>
        <button class="btn btn--ghost" data-act="msgback">◀ INBOX</button>
        ${this.footer()}`;
    }
    // the inbox: one row per person, newest conversation first
    const threads = [];
    const seenKeys = new Map();
    for (const m of s.messages) {
      const k = threadKeyOf(m);
      if (!seenKeys.has(k)) { seenKeys.set(k, { key: k, latest: m, unread: 0, count: 0 }); threads.push(seenKeys.get(k)); }
      const t = seenKeys.get(k);
      t.count += 1;
      if (!m.read) t.unread += 1;
    }
    const unread = unreadMessages(s);
    const ds = dealer.dealerState(s);
    const lastLine = ds.log[ds.log.length - 1];
    const open = dealer.activeOrder(s);
    return `${this.header('Txtr', `${unread} NEW`)}
      <div class="list">
        ${life.lifeState(s).counselor ? `
        <div class="listitem chatlist chatlist--clinic">
          ${this.senderFace('CIVIC RELIEF PROGRAM')}
          <div class="grow">
            <div class="name">KESTREL CLINIC <span class="pill">daily</span></div>
            <div class="meta">${life.lifeState(s).checkinDay === clock(s).day ? 'Checked in today. That counts.' : 'One text a day. That is the whole program.'} · ${life.lifeState(s).checkins || 0} check-ins</div>
          </div>
          <button class="btn btn--sm btn--primary" data-act="clinic" ${life.lifeState(s).checkinDay === clock(s).day ? 'disabled' : ''}>CHECK IN</button>
        </div>` : ''}
        <button class="listitem chatlist chatlist--pinned" data-act="go" data-arg="dealer" style="text-align:left;cursor:pointer;width:100%">
          ${this.senderFace('ROLO')}
          <div class="grow">
            <div class="name">${ds.unread ? '<span class="bad">● </span>' : ''}ROLO <span class="pill">pinned</span>${open ? ` <span class="pill pill--live">${open.status === 'waiting' ? 'OUTSIDE' : 'EN ROUTE'}</span>` : ''}</div>
            <div class="meta">${T(lastLine ? lastLine.text.split('\n')[0] : 'tap to text. he answers.').slice(0, 54)}</div>
          </div>
        </button>
        ${threads.length ? threads.map(({ key, latest: m, unread: n }) => `
          <button class="listitem chatlist" data-act="msgopen" data-arg="${T(key)}" style="text-align:left;cursor:pointer;width:100%">
            ${this.senderFace(m.from)}
            <div class="grow">
              <div class="name">${n ? '<span class="bad">● </span>' : ''}${T(m.from)}${n > 1 ? ` <span class="pill">${n}</span>` : ''}</div>
              <div class="meta">${T((m.replies && m.replies.length ? m.replies[m.replies.length - 1].text : m.body)).slice(0, 54)}</div>
            </div>
          </button>`).join('') : '<div class="empty">No messages. Everyone is giving you space. That is what that is.</div>'}
      </div>
      <div class="tiny mono-dim">Replies you send from the HUD thread show up here too.</div>
      ${this.footer()}`;
  }

  /* ------------------------------ ROLO: the thread ------------------------------ */

  dealerView() {
    const s = this.g.state;
    const d = dealer.dealerState(s);
    d.unread = 0;
    const moFace = portraitURL('mo', this.g.hud?.mood?.id || 'content');
    const rows = d.log.map((l) => l.from === 'mo'
      ? `<div class="chat__row chat__row--out"><div class="chat__bubble chat__bubble--out">${T(l.text).replace(/\n/g, '<br>')}</div><img class="chat__face" src="${moFace}" alt="" /></div>`
      : `<div class="chat__row">${this.senderFace('ROLO')}<div class="chat__bubble chat__bubble--in">${T(l.text).replace(/\n/g, '<br>')}</div></div>`).join('');
    const typing = dealer.isTyping();
    const o = dealer.activeOrder(s);
    return `${this.header('ROLO', o ? o.id : 'SMS')}
      ${o ? this.orderCard(o) : ''}
      <div class="chat">${rows || '<div class="empty">No history. Rolo prefers it that way.</div>'}
        ${typing ? `<div class="chat__row">${this.senderFace('ROLO')}<div class="chat__bubble chat__bubble--in chat__typing"><i></i><i></i><i></i></div></div>` : ''}
      </div>
      <div class="chat__quick">
        ${dealer.smsOptions(s).map((q) => `<button class="chat__chip" data-act="dealersay" data-arg="${q.key}" ${typing ? 'disabled' : ''}>${T(q.label)}</button>`).join('')}
      </div>
      <button class="btn btn--ghost" data-nav="messages">◀ INBOX</button>
      ${this.footer()}`;
  }

  orderCard(o) {
    const stat = o.status === 'waiting' && !o.arrived ? 'NEARLY THERE' : ({ pending: 'EN ROUTE', waiting: 'WAITING OUTSIDE', completed: 'COMPLETED', cancelled: 'CANCELLED', expired: 'EXPIRED' }[o.status] || o.status);
    return `<div class="ordercard ordercard--${o.status}">
      <div class="row row--between"><b>${T(o.id)}</b><span class="pill pill--live">${stat}</span></div>
      <div>${o.qty}x ${T(o.name)} · <b>$${o.total.toFixed(2)}</b> cash on meet</div>
      <div class="tiny mono-dim">${o.status === 'pending' ? `ETA ${hhmm(o.meetAt)} · ` : ''}${T(o.spot?.label || '')}</div>
    </div>`;
  }

  /* ------------------------------ ROLO'S LINE: the app ------------------------------ */

  /**
   * A crude WAP page from 1999: one font, one colour, numbered links, a balance line. It is a
   * second face on the same order system the text thread uses.
   */
  roloView() {
    const g = this.g;
    const s = g.state;
    const cat = dealer.catalog();
    if (!this.wapProduct || !dealer.product(this.wapProduct)) this.wapProduct = cat[0].id;
    const qty = this.wapQty || 1;
    const p = dealer.product(this.wapProduct);
    const total = dealer.quote(p.id, qty);
    const o = dealer.activeOrder(s);
    const history = dealer.dealerState(s).orders.slice(-4).reverse();
    const canPay = s.money >= total;
    return `${this.header("Rolo's Line", 'WAP 1.1')}
      <div class="wap">
        <div class="wap__bar"><span>ROLO.WAP</span><span class="wap__blink">█</span><span>BAL $${s.money.toFixed(2)}</span></div>
        ${o ? `
          <div class="wap__h">-- ORDER STATUS --</div>
          ${this.orderCard(o)}
          <div class="wap__p">${o.status === 'waiting' ? (o.arrived ? `He is outside: ${T(o.spot.label)}. Walk up and talk to him. Pay on meet.` : 'He is close. Step inside somewhere — the Quik-Stop, the bodega, home — and he will be at the hydrant when you come out.') : 'He is walking over. Status updates here and by text.'}</div>
          <button class="wap__btn" data-act="wapcancel">[0] CANCEL ORDER</button>
        ` : `
          <div class="wap__h">-- MENU -- (prices incl. walk)</div>
          ${cat.map((c, i) => `
            <button class="wap__item ${c.id === p.id ? 'on' : ''}" data-act="wappick" data-arg="${c.id}">
              <span>[${i + 1}] ${T(c.name)}</span><span>$${c.unit.toFixed(2)}</span>
              <em>${T(c.flavor)} risk+${c.risk} dep+${c.addiction}</em>
            </button>`).join('')}
          <div class="wap__h">-- QTY --</div>
          <div class="wap__qty">
            <button class="wap__btn" data-act="wapqty" data-num="-1" ${qty <= 1 ? 'disabled' : ''}>[-]</button>
            <b>${qty}</b>
            <button class="wap__btn" data-act="wapqty" data-num="1" ${qty >= dealer.DEALER.maxQty ? 'disabled' : ''}>[+]</button>
            <span>max ${dealer.DEALER.maxQty}</span>
          </div>
          <div class="wap__total">${qty}x ${T(p.name)} = <b>$${total.toFixed(2)}</b></div>
          ${canPay ? '' : `<div class="wap__err">! INSUFFICIENT FUNDS ($${s.money.toFixed(2)})</div>`}
          ${this.wapNote ? `<div class="wap__err">! ${T(this.wapNote.toUpperCase())}</div>` : ''}
          <button class="wap__btn wap__btn--go" data-act="waporder" ${canPay ? '' : 'disabled'}>[#] PLACE ORDER</button>
          <div class="wap__p">Cash on meet. One order at a time. Fictional substances only.</div>
        `}
        <div class="wap__h">-- LAST ORDERS --</div>
        ${history.length ? history.map((h) => `<div class="wap__hist"><span>${T(h.id)} ${h.qty}x ${T(h.name)}</span><span>${h.status.toUpperCase()}</span></div>`).join('') : '<div class="wap__p">none</div>'}
        <div class="wap__bar wap__bar--foot"><span>(c)1999 ROLO</span><button class="wap__link" data-act="go" data-arg="dealer">TEXT HIM &gt;</button></div>
      </div>
      ${this.footer()}`;
  }

  /** What he owes outside the monthly bills: the hospital, the landlord he left. */
  debtCard() {
    const s = this.g.state;
    const owe = life.totalDebt(s);
    if (!owe) return '';
    const d = life.lifeState(s).debt;
    return `<div class="card debtcard">
      <div class="kv"><span class="tiny mono-dim">DEBT · grows ~1%/day</span><b class="bad">${money(owe)}</b></div>
      ${d.hospital ? `<div class="kv"><span>Kings County Hospital</span><b>${money(d.hospital)}</b></div>` : ''}
      ${d.rent ? `<div class="kv"><span>Rae Vell (arrears)</span><b>${money(d.rent)}</b></div>` : ''}
      <div class="row row--wrap" style="margin-top:6px">
        ${[20, 50, 100].map((n) => `<button class="btn btn--sm" data-act="paydebt" data-num="${n}" ${s.money < n ? 'disabled' : ''}>PAY $${n}</button>`).join('')}
        <button class="btn btn--sm btn--primary" data-act="paydebt" data-num="0" ${s.money <= 0 ? 'disabled' : ''}>PAY ALL YOU CAN</button>
      </div>
    </div>`;
  }

  /** A sender's avatar: a company's app icon, or a person's face. */
  senderFace(from) {
    return serviceAvatar(from, 'chat__face') || `<img class="chat__face" src="${portraitURL(kindForName(from), 'content')}" alt="" />`;
  }

  /* ------------------------------ INVENTORY ------------------------------ */

  inventoryView() {
    const s = this.g.state;
    const items = inventoryList(s);
    return `${this.header('Pocket Lint', `${items.length} ITEMS`)}
      <div class="list list--tiles">
        ${items.length ? items.map((i) => {
          const def = i.def;
          let buttons = '';
          if (def.kind === 'food' || def.kind === 'comfort') buttons = `<button class="btn btn--sm btn--primary" data-act="eatitem" data-arg="${i.id}">${def.kind === 'food' ? 'EAT' : i.id === 'loosies' ? 'SMOKE' : 'DRINK'}</button>`;
          else if (def.kind === 'substance') buttons = `<button class="btn btn--sm btn--danger" data-act="useitem" data-arg="${i.id}">USE</button>`;
          else if (def.kind === 'valuable') buttons = `<button class="btn btn--sm" data-act="listitem" data-arg="${i.id}">SELL</button>`;
          return `<div class="listitem listitem--tile">
            ${itemIcon(i.id, def.kind)}
            <div class="grow">
              <div class="name">${T(def.name)} ${i.qty > 1 ? `x${i.qty}` : ''}</div>
              <div class="meta">${def.kind}${def.value ? ` · value ${money(def.value)}` : ''}${def.price ? ` · ${money(def.price)}` : ''}</div>
            </div>
            ${buttons}
          </div>`;
        }).join('') : '<div class="empty">Empty. Not in a poetic way.</div>'}
      </div>
      <div class="tiny mono-dim">Documents cannot be sold. You will need them for relief programs.</div>
      ${this.footer()}`;
  }

  /* ------------------------------ RENT & BILLS ------------------------------ */

  homeBillsView() {
    const g = this.g;
    const s = g.state;
    const rent = billInfo(g, 'rent');
    const power = billInfo(g, 'power');
    const phone = billInfo(g, 'phone');
    const block = (b, extra) => `
      <div class="card">
        <div class="kv"><span>${T(b.name)}</span><b class="${b.owedCycles ? 'bad' : 'creditv'}">${b.owedCycles ? money(b.owed) : 'current'}</b></div>
        <div class="tiny mono-dim">${b.owedCycles ? `${b.owedCycles} cycle(s) overdue — pay now.` : `Next due Day ${b.nextDueDay} (${b.daysLeft} days).`}</div>
        ${extra || ''}
        <div class="row" style="margin-top:6px">
          <button class="btn btn--primary btn--sm" data-act="pay" data-arg="${b.key}" ${b.owedCycles <= 0 || s.money < b.owed ? 'disabled' : ''}>PAY ${b.owedCycles ? money(b.owed) : ''}</button>
        </div>
      </div>`;
    // the thermostat that is not a thermostat: it counts down to rent instead of degrees
    const days = rent.owedCycles ? 0 : Math.max(0, rent.daysLeft);
    const frac = rent.owedCycles ? 1 : 1 - Math.min(1, days / CONFIG.economy.rent.periodDays);
    if (life.lifeState(s).housing === 'evicted') {
      const cost = life.rehouseCost(s);
      return `${this.header('Landlordly', 'NO LEASE')}
        <div class="dial dial--late" style="--f:1"><div class="dial__ring"></div><div class="dial__face"><b>✕</b><em>no lease</em></div></div>
        <div class="card">
          <div class="kv"><span>Unit 3B</span><b class="bad">locked out</b></div>
          <div class="kv"><span>Arrears (with interest)</span><b>${money(life.lifeState(s).debt.rent || 0)}</b></div>
          <div class="kv"><span>Deposit</span><b>${money(life.LIFE.deposit)}</b></div>
          <div class="kv"><span>To get back in</span><b>${money(cost)}</b></div>
          <div class="row" style="margin-top:6px"><button class="btn btn--primary btn--sm" data-act="rehouse" ${s.money < cost ? 'disabled' : ''}>PAY RAE ${money(cost)}</button></div>
        </div>
        <div class="tiny mono-dim">Until then: the bench on Kestrel after dark, or a cot at the Fellowship if Addison likes you. Habib's sink, if Habib does.</div>
        ${this.footer()}`;
    }
    return `${this.header('Landlordly', 'UNIT 3B')}
      <div class="dial ${rent.owedCycles ? 'dial--late' : ''}" style="--f:${frac.toFixed(3)}">
        <div class="dial__ring"></div>
        <div class="dial__face">
          <b>${rent.owedCycles ? '!' : days}</b>
          <em>${rent.owedCycles ? 'rent overdue' : days === 1 ? 'day to rent' : 'days to rent'}</em>
        </div>
      </div>
      ${block(rent, `<div class="tiny ${s.flags.evictionNotice ? 'bad' : 'mono-dim'}">${s.flags.evictionNotice ? 'EVICTION NOTICE POSTED. Two missed cycles ends the lease — and the run.' : `Lease: week to week. Landlord: Rae Vell. Missed cycles: ${s.bills.rent.missed}.`}</div>`)}
      ${this.rentAheadCard()}
      ${block(power, `<div class="tiny ${s.flags.powerCut ? 'bad' : 'mono-dim'}">${s.flags.powerCut ? 'POWER CUT. The fridge is silent. Showers are cold.' : 'Municipal Power. Billed every 14 days.'}</div>`)}
      ${block(phone, `<div class="tiny mono-dim">Shale Mobile. Unpaid service degrades your signal (cosmetically).</div>`)}
      <div class="app__h">Apartment</div>
      <div class="kv"><span>Coffee table</span><b>still there</b></div>
      <div class="kv"><span>Radiator</span><b>talking</b></div>
      <div class="kv"><span>Chairman</span><b>${s.flags.cat ? 'judging' : 'not adopted'}</b></div>
      ${this.footer()}`;
  }

  /* ------------------------------ CALENDAR ------------------------------ */

  calendarView() {
    const g = this.g;
    const s = g.state;
    const day = dayOf(s.clock.m);
    const course = clinic.programInfo(g);
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const d = day + i;
      const wd = (d - 1) % 7;
      const shiftDay = s.job.employed && s.job.days.includes(wd);
      const rentDue = ((d - CONFIG.economy.rent.firstDueDay) % CONFIG.economy.rent.periodDays === 0) && d >= CONFIG.economy.rent.firstDueDay;
      const powerDue = ((d - CONFIG.economy.power.firstDueDay) % CONFIG.economy.power.periodDays === 0) && d >= CONFIG.economy.power.firstDueDay;
      const service = wd === CONFIG.fellowship.serviceDay && s.fellowship.stage >= 1;
      const tags = [
        shiftDay ? '<span class="pill">shift</span>' : '',
        rentDue ? '<span class="pill" style="color:#ff8f7a">rent</span>' : '',
        powerDue ? '<span class="pill" style="color:#ffc46b">power</span>' : '',
        service ? '<span class="pill" style="color:#ffd24a">service</span>' : '',
        course.status === 'active' && d === Math.max(course.next, day) ? '<span class="pill" style="color:#7fd1ae">clinic 10-16</span>' : '',
      ].join(' ');
      rows.push(`<div class="listitem">
        <div class="grow"><div class="name">${DAY_NAMES[wd]} — Day ${d}${i === 0 ? ' (today)' : ''}</div><div class="meta">${tags || '&nbsp;'}</div></div>
        <span class="tiny mono-dim">${i === 0 ? hhmm(s.clock.m) : ''}</span>
      </div>`);
    }
    return `${this.header('iDread', `DAY ${day}`)}
      <div class="datetile">
        <em>${DAY_NAMES[(day - 1) % 7]}</em><b>${day}</b><span>${hhmm(s.clock.m)} · ${this.nextObligation()}</span>
      </div>
      <div class="list">${rows.join('')}</div>
      <div class="app__h">Sleep</div>
      <div class="row row--wrap">
        <button class="btn btn--sm" data-act="sleep" data-num="4">4 HOURS</button>
        <button class="btn btn--sm" data-act="sleep" data-num="7">7 HOURS</button>
        <button class="btn btn--sm" data-act="sleep" data-num="9">9 HOURS</button>
      </div>
      <div class="tiny mono-dim">Sleeping from the phone works anywhere, including places you should not sleep.</div>
      ${this.footer()}`;
  }

  /* ------------------------------ SOCIAL ------------------------------ */

  socialView() {
    const g = this.g;
    const s = g.state;
    const posts = s.feedPosts || [];
    const so = social.socialState(s);
    const tab = this.feedTab || 'feed';
    const tabBtn = (id, label, cls = '') => `<button class="${cls} ${tab === id ? 'on' : ''}" data-act="feedtab" data-arg="${id}">${label}</button>`;
    const tabs = `<div class="feedtabs">${tabBtn('feed', 'FEED')}${tabBtn('people', 'PEOPLE')}${tabBtn('hearts', '♥ HEARTS', 'feedtabs__hearts')}${tabBtn('love', 'LOVELINE')}</div>`;
    if (tab === 'hearts') return `${this.header('FeedLove', 'HEARTS')}${tabs}${this.heartsView()}${this.footer()}`;
    if (tab === 'love') return `${this.header('FeedLove', 'LOVELINE')}${tabs}${this.loveBody()}${this.footer()}`;
    if (tab === 'people') return `${this.header('FeedLove', `${so.followers} FOLLOWERS`)}${tabs}${this.peopleView()}${this.footer()}`;
    const face = (id) => {
      const a = social.ACCOUNTS[id];
      return a.kind ? `<img class="fpost__face" src="${portraitURL(a.kind, 'content')}" alt="" />` : `<span class="fpost__face fpost__face--brand" style="--c:${a.color}">${a.initial}</span>`;
    };
    const tl = social.timeline(s).slice(0, 30);
    const today = dayOf(s.clock.m);
    const when = (p) => (p.day === today ? hhmm(p.minute) : p.day === today - 1 ? 'yesterday' : `${today - p.day}d ago`);
    const mine = posts.slice(-5).reverse().map((p) => `
      <div class="fpost fpost--mine">
        <div class="fpost__head"><img class="fpost__face" src="${portraitURL('mo', 'content')}" alt="" /><b>@mofunctional</b><span>D${p.day}</span></div>
        <div class="fpost__text">${T(p.text)}</div>
        <div class="fpost__meta"><span class="post__heart">♥</span> ${p.likes} · ${p.replies} replies${p.likedBy?.length ? ` · liked by ${T(p.likedBy.map((id) => social.ACCOUNTS[id]?.name || id).join(', '))}` : ''}</div>
      </div>`).join('');
    return `${this.header('FeedLove', `${so.followers} FOLLOWERS`)}${tabs}
      <div class="profile profile--feed">
        <span class="profile__ring"><img src="${portraitURL('mo', this.g.hud?.mood?.id || 'content')}" alt="" /></span>
        <div class="profile__stats">
          <span><b>${posts.length}</b>posts</span>
          <button class="profile__stat" data-act="feedtab" data-arg="people"><b>${so.followers}</b>followers</button>
          <button class="profile__stat" data-act="feedtab" data-arg="people"><b>${so.following.length}</b>following</button>
        </div>
      </div>
      <div class="tiny"><b>@mofunctional</b> · ${T(s.feedBio || 'not really a brand. a person. mostly.')}</div>
      <div class="fcompose">
        <input id="feedtext" type="text" maxlength="140" placeholder="what's on your mind, Mo?" autocomplete="off" spellcheck="false" />
        <button class="btn btn--primary btn--sm" data-act="posttyped">POST</button>
      </div>
      <button class="btn btn--sm" data-act="post">POST SOMETHING (10 MIN)</button>
      ${mine ? `<div class="app__h">Your posts</div>${mine}` : ''}
      <div class="app__h">Your feed</div>
      ${tl.length ? tl.map((p) => {
        const a = social.ACCOUNTS[p.author];
        const liked = !!so.liked[p.id];
        return `<div class="fpost">
          <div class="fpost__head">${face(p.author)}<b>${T(a.name)}</b><em>@${T(a.handle)}</em><span>${when(p)}</span></div>
          <div class="fpost__text">${T(p.text)}</div>
          ${postImage(p, a.kind)}
          <div class="fpost__meta"><button class="fpost__like ${liked ? 'on' : ''}" data-act="likepost" data-arg="${p.id}">♥ ${p.likes + (liked ? 1 : 0)}</button></div>
        </div>`;
      }).join('') : '<div class="empty">You follow nobody who posts. Go to PEOPLE.</div>'}
      ${this.footer()}`;
  }

  /** FeedLove PEOPLE: who he follows, who follows him, and who he could follow. */
  peopleView() {
    const s = this.g.state;
    const so = social.socialState(s);
    const ids = Object.keys(social.ACCOUNTS).filter((id) => social.accountVisible(s, id));
    const row = (id, btn) => {
      const a = social.ACCOUNTS[id];
      const face = a.kind ? `<img class="chat__face" src="${portraitURL(a.kind, 'content')}" alt="" />` : `<span class="chat__face fpost__face--brand" style="--c:${a.color}">${a.initial}</span>`;
      const back = social.followsMo(s, id) ? '<span class="pill">follows you</span>' : '';
      return `<div class="listitem">${face}<div class="grow"><div class="name">${T(a.name)} ${back}</div><div class="meta">@${T(a.handle)}</div></div>${btn}</div>`;
    };
    const following = so.following.filter((id) => ids.includes(id));
    const others = ids.filter((id) => !so.following.includes(id));
    const fl = social.followerList(s);
    return `
      <div class="app__h">Following · ${following.length}</div>
      <div class="list">${following.map((id) => row(id, `<button class="btn btn--sm" data-act="follow" data-arg="${id}" data-num="0">UNFOLLOW</button>`)).join('') || '<div class="empty">Nobody. Bold.</div>'}</div>
      <div class="app__h">Followers · ${so.followers}</div>
      <div class="list">${fl.named.map((id) => row(id, so.following.includes(id) ? '' : `<button class="btn btn--sm btn--primary" data-act="follow" data-arg="${id}" data-num="1">FOLLOW BACK</button>`)).join('')}
        ${fl.others ? `<div class="tiny mono-dim">and ${fl.others} other${fl.others === 1 ? '' : 's'} — a cousin, a guy from high school, and several accounts selling sunglasses.</div>` : ''}</div>
      ${others.length ? `<div class="app__h">People you may know</div>
      <div class="list">${others.map((id) => row(id, `<button class="btn btn--sm btn--primary" data-act="follow" data-arg="${id}" data-num="1">FOLLOW</button>`)).join('')}</div>` : ''}
      <div class="tiny mono-dim">Stephanie, Melanie and Diana show up here once you have met them. Follow her and she may follow you back; like her posts and she notices.</div>`;
  }

  /** FeedLove HEARTS: today's stack of profiles. Strangers mostly say no; the three answer. */
  heartsView() {
    const s = this.g.state;
    const d = dating.datingState(s);
    const left = CONFIG.dating.heartsPerDay - (d.day === dayOf(s.clock.m) ? d.hearts : 0);
    const matched = romance.PARTNER_KEYS.filter((id) => d.matched[id] || romance.partnerState(s, id).met);
    const card = (p) => {
      const res = d.results[p.id];
      const avatar = p.partner
        ? `<img class="dprof__img" src="${portraitURL(p.partner, 'content')}" alt="" />`
        : `<img class="dprof__img" src="${portraitURL(p.face, 'content')}" alt="" />`;
      const verdict = res === 'match' ? '<span class="dprof__res dprof__res--match">MATCH · numbers swapped</span>'
        : res === 'hookup' ? '<span class="dprof__res dprof__res--match">MATCH · not for dating</span>'
        : res === 'ghost' ? '<span class="dprof__res">matched, then nothing</span>'
          : res === 'reject' ? '<span class="dprof__res dprof__res--no">no</span>' : '';
      return `<div class="dprof">
        ${avatar}
        <div class="grow"><div class="name">${T(p.name)}, ${p.age} <span class="tiny mono-dim">· ${T(p.hood)}</span></div>
        <div class="meta">${T(p.bio)}</div>${verdict}</div>
        ${res ? '' : `<button class="btn btn--sm btn--primary" data-act="heart" data-arg="${p.id}" ${left <= 0 ? 'disabled' : ''}>♥</button>`}
      </div>`;
    };
    return `
      ${this.heartNote ? `<div class="card dnote">${T(this.heartNote)}</div>` : ''}
      ${matched.length ? `<div class="app__h">Your matches</div>
      <div class="list">${matched.map((id) => {
        const p = CONFIG.partners[id];
        const st = romance.partnerState(s, id);
        return `<div class="listitem dmatch">
          <img class="chat__face" src="${portraitURL(id, 'content')}" alt="" />
          <div class="grow"><div class="name">${T(p.name)} ${st.girlfriend ? '<span class="pill">girlfriend</span>' : ''}</div><div class="meta">${st.dates} date${st.dates === 1 ? '' : 's'} · in your Txtr contacts</div></div>
          <button class="btn btn--sm" data-act="dmchat" data-arg="${id}">TEXT</button>
          <button class="btn btn--sm btn--primary" data-act="dmdate" data-arg="${id}">ASK OUT</button>
        </div>`;
      }).join('')}</div>` : ''}
      ${(() => {
        const late = dating.hookupContacts(s);
        if (!late.length) return '';
        return `<div class="app__h">Not for dating</div>
        <div class="list">${late.map((w) => {
          const av = dating.hookupAvailable(s, w.id);
          const h = d.hookups[w.id];
          return `<div class="listitem dmatch">
            <img class="chat__face" src="${portraitURL(w.id, 'content')}" alt="" />
            <div class="grow"><div class="name">${T(w.name)}, ${w.age} <span class="tiny mono-dim">· ${T(w.hood)}</span></div><div class="meta">${h.count ? `${h.count} night${h.count === 1 ? '' : 's'} · ` : ''}${av.ok ? 'she is up' : T(av.reason)}</div></div>
            <button class="btn btn--sm btn--primary" data-act="hookup" data-arg="${w.id}" ${av.ok ? '' : 'disabled'}>HOOK UP</button>
          </div>`;
        }).join('')}</div>`;
      })()}
      <div class="app__h">Today's stack · ${Math.max(0, left)} hearts left</div>
      <div class="list">${dating.profilesToday(s).map(card).join('')}</div>
      <div class="tiny mono-dim">A heart takes ${CONFIG.dating.heartMinutes} minutes of staring. New faces every morning.</div>`;
  }

  /* ------------------------------ FELLOWSHIP ------------------------------ */

  fellowshipView() {
    const s = this.g.state;
    const st = fellowshipStage(s);
    const win = serviceWindow(this.g);
    return `${this.header('The Golden Fellowship', 'SALT & GOLD')}
      <div class="stream">
        <span class="stream__live">${win.inWindow ? 'LIVE' : 'NEXT'}</span>
        <img src="${portraitURL('addison', 'content')}" alt="" />
        <div><b>Sunday Service with Addison Octavius</b><em>${win.isSunday ? (win.inWindow ? 'Streaming now · tithe button enabled' : 'Today 11:00 · set a reminder') : 'Sunday 11:00 · skip intro: $4.99'}</em></div>
      </div>
      <div class="card panel--gold" style="border-color:#7a5c1e">
        <div class="tiny" style="color:#ffd24a;letter-spacing:.2em">${T(st.label.toUpperCase())}</div>
        <div class="tiny mono-dim">${T(st.note)}</div>
        <div class="hr"></div>
        <div class="kv"><span>Shepherd</span><b>Addison Octavius</b></div>
        <div class="kv"><span>Allowance</span><b>${s.fellowship.stage >= 2 ? money(CONFIG.fellowship.allowance) + ' / service' : '—'}</b></div>
        <div class="kv"><span>Tithe owed</span><b class="${s.fellowship.titheOwed > 0 ? 'bad' : 'creditv'}">${money(s.fellowship.titheOwed)}</b></div>
        <div class="kv"><span>Next service</span><b>${win.isSunday ? (win.inWindow ? 'NOW' : 'today 11:00') : 'Sunday 11:00'}</b></div>
      </div>
      <div class="tiny">"We do not ask you to be good. We ask you to be honest, and then we charge a modest fee for the honesty."</div>
      <div class="row row--wrap">
        <button class="btn btn--gold" data-act="govisit">VISIT THE FELLOWSHIP</button>
        <button class="btn btn--sm" data-act="textaddison">TEXT ADDISON</button>
      </div>
      <div class="tiny mono-dim">Visiting takes real time. Services are Sunday 11:00. The allowance is not free; it is only cheap.</div>
      ${this.footer()}`;
  }

  /* ------------------------------ SYSTEM ------------------------------ */

  systemView() {
    const g = this.g;
    const s = g.state;
    return `${this.header('Tweaks', 'SETTINGS')}
      <div class="row row--wrap">
        <button class="btn btn--sm ${s.settings.crt ? 'on btn--primary' : ''}" data-act="togglecrt">CRT: ${s.settings.crt ? 'ON' : 'OFF'}</button>
        <button class="btn btn--sm ${s.settings.ratio43 ? 'btn--primary' : ''}" data-act="toggle43">4:3: ${s.settings.ratio43 ? 'ON' : 'OFF'}</button>
      </div>
      <div class="app__h">Theme</div>
      <div class="theme-grid">
        ${THEMES.map((t) => `<button class="theme-swatch ${s.settings.theme === t.id ? 'on' : ''}" data-act="theme" data-arg="${t.id}">
          <i style="background:${t.dot}"></i>
          <span><b>${T(t.label)}</b><em>${T(t.note)}</em></span>
        </button>`).join('')}
      </div>
      <div class="app__h">Interface scale</div>
      <div class="row">
        ${SCALES.map((sc) => `<button class="btn btn--sm ${Math.abs((s.settings.scale ?? 1) - sc.value) < 0.01 ? 'btn--primary' : ''}" data-act="scale" data-num="${sc.value}">${sc.label}</button>`).join('')}
        <span class="tiny mono-dim">${Math.round((s.settings.scale ?? 1) * 100)}% · ${T(themeLabel(s.settings.theme))}</span>
      </div>
      <div class="app__h">Camera</div>
      <div class="kv"><span class="mono-dim">Distance</span><b data-live="camdist">${Math.round((s.settings.camDist ?? 1) * 100)}%</b></div>
      <input type="range" min="70" max="140" step="1" value="${Math.round((s.settings.camDist ?? 1) * 100)}" data-act="camdist" style="width:100%" />
      <div class="kv"><span class="mono-dim">Height</span><b data-live="camheight">${Math.round((s.settings.camHeight ?? 1) * 100)}%</b></div>
      <input type="range" min="80" max="135" step="1" value="${Math.round((s.settings.camHeight ?? 1) * 100)}" data-act="camheight" style="width:100%" />
      <div class="row" style="margin-top:4px">
        <button class="btn btn--sm btn--ghost" data-act="camreset">RESET</button>
        <span class="tiny mono-dim">Distance pulls the arm back; height raises the eye on it.</span>
      </div>
      <div class="app__h">Volume</div>
      <div class="kv"><span class="mono-dim">Music</span><b data-live="musicvol">${Math.round((s.settings.volume ?? 0.7) * 100)}%</b></div>
      <input type="range" min="0" max="100" value="${Math.round((s.settings.volume ?? 0.7) * 100)}" data-act="volume" style="width:100%" />
      <div class="kv"><span class="mono-dim">Sound effects</span><b data-live="sfxvol">${Math.round((s.settings.sfxVolume ?? 0.5) * 100)}%</b></div>
      <input type="range" min="0" max="100" value="${Math.round((s.settings.sfxVolume ?? 0.5) * 100)}" data-act="sfxvolume" style="width:100%" />
      <div class="row" style="margin-top:4px">
        <button class="btn btn--sm ${s.settings.muted ? 'btn--primary' : ''}" data-act="mute">${s.settings.muted ? 'UNMUTE' : 'MUTE ALL'}</button>
        <span class="tiny mono-dim">Two buses: the soundtrack, and everything the game makes itself.</span>
      </div>
      <div class="app__h">Save / Load</div>
      <div class="list">
        ${[1, 2, 3].map((n) => {
          const info = g.slotInfo ? g.slotInfo(n) : null;
          return `<div class="listitem">
            <div class="grow"><div class="name">Slot ${n}</div><div class="meta">${info ? `Day ${info.day} · ${money(info.money)}` : 'empty'}</div></div>
            <button class="btn btn--sm" data-act="save" data-arg="${n}">SAVE</button>
            <button class="btn btn--sm" data-act="load" data-arg="${n}" ${info ? '' : 'disabled'}>LOAD</button>
          </div>`;
        }).join('')}
      </div>
      <div class="app__h">Run stats</div>
      <div class="kv"><span>Days survived</span><b>${s.counters.daysSurvived}</b></div>
      <div class="kv"><span>Shifts worked</span><b>${s.counters.shifts}</b></div>
      <div class="kv"><span>Meals eaten</span><b>${s.counters.meals}</b></div>
      <div class="kv"><span>Doses used</span><b>${s.counters.doses}</b></div>
      <div class="kv"><span>Money earned</span><b>${money(s.counters.moneyEarned)}</b></div>
      <div class="row" style="margin-top:8px">
        <button class="btn btn--ghost btn--sm" data-act="quitmenu">QUIT TO MENU</button>
        <button class="btn btn--sm" data-act="closebook">CLOSE THE BOOK</button>
      </div>
      ${this.footer()}`;
  }

  /* ------------------------------ RENT, EARLY ------------------------------ */

  /**
   * Rent on one card: what this cycle costs after a partner's share, what is outstanding, the day
   * the next one falls due, the one-cycle pay-ahead, and the receipts.
   */
  rentAheadCard() {
    const g = this.g;
    const s = g.state;
    const r = rent.rentStatus(g);
    if (r.noLease) return '';
    const period = CONFIG.economy.rent.periodDays;
    const paidCycleDay = r.paidAhead ? r.nextDueDay - period : null;
    const hist = r.history.slice(0, 4);
    return `<div class="card rentcard">
      <div class="kv"><span>Rent this cycle</span><b>${money(r.perCycle)}</b></div>
      ${r.contribution > 0 ? `<div class="kv"><span>Household contribution (${Math.round(r.share * 100)}%)</span><b class="creditv">-${money(r.contribution)}</b></div>` : ''}
      <div class="kv"><span>${r.owedCycles ? 'Outstanding' : 'Next due'}</span><b class="${r.owedCycles ? 'bad' : 'creditv'}">${r.owedCycles ? money(r.owed) : `Day ${r.nextDueDay}`}</b></div>
      ${r.paidAhead ? `<div class="kv"><span>Paid ahead</span><b class="creditv">Day ${paidCycleDay}</b></div>` : ''}
      <div class="row" style="margin-top:6px">
        <button class="btn btn--primary btn--sm" data-act="pay" data-arg="rent" ${r.canPayNow ? '' : 'disabled'}>PAY ${r.owedCycles ? money(r.owed) : 'NOW'}</button>
        <button class="btn btn--gold btn--sm" data-act="rentahead" ${r.canPayAhead ? '' : 'disabled'}>PAY EARLY · ${money(r.aheadCost)}</button>
      </div>
      <div class="tiny ${r.paidAhead ? 'creditv' : 'mono-dim'}">${r.paidAhead
        ? `Day ${paidCycleDay} is settled in advance. Nothing will be charged again when it arrives.`
        : `Paying early settles Day ${r.aheadForDay} now. Rent stays due Day ${r.nextDueDay} otherwise.`}</div>
      <div class="app__h">Rent history</div>
      ${hist.length
        ? hist.map((h) => `<div class="kv"><span class="tiny">D${h.day} · ${h.ahead ? 'early' : 'paid'} · covers Day ${h.forDay}</span><b>${money(h.amount)}</b></div>`).join('')
        : '<div class="tiny mono-dim">No rent paid yet. Rae has a clipboard with one name on it.</div>'}
    </div>`;
  }

  /* ------------------------------ DATING ------------------------------ */

  datesView() { return `${this.header('LoveLine', 'KESTREL ST.')}${this.loveBody()}${this.footer()}`; }

  loveBody() {
    const g = this.g;
    const s = g.state;
    const cards = romance.PARTNER_KEYS.map((id) => {
      const p = CONFIG.partners[id];
      const st = romance.partnerState(s, id);
      const status = st.liveIn ? 'lives with you' : st.girlfriend ? 'your girlfriend' : st.dates ? `${st.dates} date${st.dates === 1 ? '' : 's'} · ${st.failed} that did not land` : 'you have not met';
      return `<div class="card loveline">
        <div class="listitem">
          ${this.senderFace(p.name.toUpperCase())}
          <div class="grow">
            <div class="name">${T(p.name)}</div>
            <div class="meta">${T(status)} · affection ${st.affection}/100</div>
          </div>
        </div>
        <div class="tiny mono-dim">${T(p.blurb)}</div>
        <div class="tiny lwhere"><b>Now:</b> ${T(partnerWhereabouts(id, minuteOfDay(s.clock.m), s.romance?.liveIn))}</div>
        <details class="lsched"><summary class="tiny">Her usual day</summary>${PARTNER_SCHEDULES[id].map((row) => `<div class="tiny mono-dim">${hhmm(row.from)}–${hhmm(row.to)} · ${T(row.away ? row.note : `${PARTNER_AREA_NAMES[row.area]}, ${row.note}`)}</div>`).join('')}</details>
        <div class="row row--wrap" style="margin-top:6px">
          <button class="btn btn--sm" data-act="datechat" data-arg="${id}">TALK</button>
          <button class="btn btn--sm" data-act="dateflirt" data-arg="${id}">FLIRT</button>
          <button class="btn btn--sm btn--primary" data-act="datedate" data-arg="${id}" ${st.met ? '' : 'disabled'}>DATE</button>
          ${!st.girlfriend ? `<button class="btn btn--sm btn--gold" data-act="dateskin" data-arg="${id}" ${romance.canAskGirlfriend(s, id) ? '' : 'disabled'}>BE MY GIRLFRIEND</button>` : ''}
          ${st.girlfriend && !st.liveIn ? `<button class="btn btn--sm btn--gold" data-act="datemove" data-arg="${id}" ${romance.canAskMoveIn(s, id) ? '' : 'disabled'}>MOVE IN</button>` : ''}
        </div>
      </div>`;
    }).join('');
    return `
      <button class="card dfind" data-act="openhearts">
        <b>♥ Find someone on FeedLove HEARTS</b>
        <span class="tiny">today's stack of profiles · send hearts · swap numbers</span>
      </button>
      ${cards}
      <div class="tiny mono-dim">Find her where her day takes her: the park, the Quik-Stop, the bodega, Habib's, the street. Get close and you can hug, hold hands, and let her kiss your cheek.
      <br><b>${T(romance.afterglowLabel(s) || 'No Afterglow right now.')}</b></div>
      ${this.footer()}`;
  }

  /* ------------------------------ HARDLUCK BET ------------------------------ */

  casinoView() {
    const s = this.g.state;
    const cs = casino.casinoState(s);
    const game = this.casinoGame || 'slots';
    const bet = this.casinoBet || CONFIG.casino.bets[0];
    const tabBtn = (id, label) => `<button class="${game === id ? 'on' : ''}" data-act="casgame" data-arg="${id}">${label}</button>`;
    const bets = `<div class="cas__bets">${CONFIG.casino.bets.map((b) => `<button class="${b === bet ? 'on' : ''}" data-act="casbet" data-num="${b}" ${casino.canBet(s, b) ? '' : 'disabled'}>$${b}</button>`).join('')}</div>`;
    const card = (c) => `<span class="cas__card ${c.s === '♥' || c.s === '♦' ? 'red' : ''}">${c.r}${c.s}</span>`;
    let table = '';
    if (game === 'slots') {
      const r = this.casLast?.reels || ['seven', 'seven', 'seven'];
      const glyph = (id) => casino.REELS.find((x) => x.id === id).glyph;
      table = `<div class="cas__slots">${r.map((id) => `<span class="cas__reel">${glyph(id)}</span>`).join('')}</div>
        <div class="cas__msg">${this.casLast ? (this.casLast.payout ? `WIN $${this.casLast.payout}` : 'Nothing. Spin again? (That is the app talking.)') : 'Three of a kind pays. Two cherries pays double.'}</div>
        ${bets}<button class="btn btn--primary cas__go" data-act="casspin" ${casino.canBet(s, bet) ? '' : 'disabled'}>SPIN · $${bet}</button>
        <div class="tiny mono-dim">💰×180 · 7×70 · BAR×30 · 🔔×15 · 🍋×8 · 🍒×6</div>`;
    } else if (game === 'blackjack') {
      const t = this.bj;
      if (!t || t.done) {
        table = `${t ? `<div class="cas__hand"><em>Dealer ${casino.handValue(t.dealer)}</em>${t.dealer.map(card).join('')}</div>
          <div class="cas__hand"><em>You ${casino.handValue(t.player)}</em>${t.player.map(card).join('')}</div>
          <div class="cas__msg">${T(t.result)}</div>` : '<div class="cas__msg">Dealer stands on 17. Blackjack pays 3 to 2.</div>'}
          ${bets}<button class="btn btn--primary cas__go" data-act="casdeal" ${casino.canBet(s, bet) ? '' : 'disabled'}>DEAL · $${bet}</button>`;
      } else {
        table = `<div class="cas__hand"><em>Dealer</em>${card(t.dealer[0])}<span class="cas__card cas__card--back">?</span></div>
          <div class="cas__hand"><em>You ${casino.handValue(t.player)}</em>${t.player.map(card).join('')}</div>
          <div class="row row--wrap">
            <button class="btn btn--primary" data-act="cashit">HIT</button>
            <button class="btn" data-act="casstand">STAND</button>
            ${t.player.length === 2 ? `<button class="btn" data-act="casdouble" ${s.money >= t.bet ? '' : 'disabled'}>DOUBLE</button>` : ''}
          </div>`;
      }
    } else {
      const l = this.rlLast;
      table = `<div class="cas__wheel ${l ? `cas__wheel--${l.landed}` : ''}">${l ? l.pocket : '?'}</div>
        <div class="cas__msg">${l ? (l.payout ? `${l.landed.toUpperCase()}. WIN $${l.payout}` : `${l.landed.toUpperCase()}. The house thanks you.`) : 'Red or black pays even money. Green pays 17 to 1.'}</div>
        ${bets}<div class="row row--wrap">
          <button class="btn cas__red" data-act="casrl" data-arg="red" ${casino.canBet(s, bet) ? '' : 'disabled'}>RED</button>
          <button class="btn cas__black" data-act="casrl" data-arg="black" ${casino.canBet(s, bet) ? '' : 'disabled'}>BLACK</button>
          <button class="btn cas__green" data-act="casrl" data-arg="green" ${casino.canBet(s, bet) ? '' : 'disabled'}>GREEN</button>
        </div>`;
    }
    const net = cs.won - cs.wagered;
    return `${this.header('HardLuck Bet', money(s.money))}
      ${cs.bonusUsed ? '' : `<div class="card cas__promo">NEW PLAYER BONUS · your first bet up to $${CONFIG.casino.freeBet} is free</div>`}
      <div class="feedtabs feedtabs--cas">${tabBtn('slots', 'SLOTS')}${tabBtn('blackjack', 'BLACKJACK')}${tabBtn('roulette', 'ROULETTE')}</div>
      <div class="cas__table">${table}</div>
      <div class="tiny mono-dim">Lifetime: wagered ${money(cs.wagered)} · ${net >= 0 ? 'up' : 'down'} ${money(Math.abs(net))}${cs.bigWin ? ` · best win ${money(cs.bigWin)}` : ''}. Gamble responsibly. (We have to say that. We do not have to mean it.)</div>
      ${this.footer()}`;
  }

  /* ------------------------------ NEXTSTOOP ------------------------------ */

  /** The neighbourhood app: who was seen where, today's board, and the history of the block. */
  blockView() {
    const s = this.g.state;
    const tab = this.blockTab || 'now';
    const tabBtn = (id, label) => `<button class="${tab === id ? 'on' : ''}" data-act="blocktab" data-arg="${id}">${label}</button>`;
    let body = '';
    if (tab === 'now') {
      body = `<div class="tiny mono-dim">Posted by neighbours in the last hour. Mostly accurate.</div>
        ${block.sightings(s).map((x) => `<div class="nstoop"><div class="nstoop__who">${T(x.who)} <span>· just now</span></div><div>${T(x.text)}</div></div>`).join('')}`;
    } else if (tab === 'board') {
      const board = block.boardToday(s);
      body = board.length ? '' : '<div class="empty">Quiet so far today. Give it an hour; somebody will lose a cat.</div>';
      body += board.map((x) => `<div class="nstoop"><div class="nstoop__cat">${T(x.cat)}</div>
        <div class="nstoop__who">${T(x.who)} <span>· ${T(x.where)} · ${hhmm(x.minute)}</span></div><div>${T(x.text)}</div>
        <div class="tiny mono-dim">${x.replies} repl${x.replies === 1 ? 'y' : 'ies'}</div></div>`).join('');
    } else if (tab === 'post') {
      body = stoopPostBody(this);
    } else {
      const lore = block.loreUnlocked(s);
      body = `${lore.map((x) => `<details class="nstoop nstoop--lore"><summary><b>${T(x.title)}</b></summary><div>${T(x.body)}</div></details>`).join('')}
        ${lore.length < block.LORE.length ? `<div class="tiny mono-dim">Pat from the block association adds a page every day. ${block.LORE.length - lore.length} more to come.</div>` : ''}`;
    }
    return `${this.header('NextStoop', 'KESTREL ST.')}
      <div class="feedtabs feedtabs--stoop">${tabBtn('now', 'SEEN NOW')}${tabBtn('board', 'THE BOARD')}${tabBtn('lore', 'HISTORY')}${tabBtn('post', 'POST')}</div>
      ${body}
      ${this.footer()}`;
  }

  /* ------------------------------ CLINIC ------------------------------ */

  clinicView() {
    const s = this.g.state;
    const info = clinic.treatmentInfo(this.g);
    const l = life.lifeState(s);
    const c = clinic.clinicState(s);
    const checkedToday = c.lastVisitDay === dayOf(s.clock.m) && l.checkinDay === dayOf(s.clock.m);
    return `${this.header('Kestrel Clinic', 'WALK-INS')}
      <div class="card">
        <div class="kv"><span>${T(clinic.nurseName)}</span><b>in today</b></div>
        <div class="kv"><span>Treatment</span><b>${money(info.cost)} · ${info.minutes} min</b></div>
        <div class="kv"><span>Risk</span><b class="${s.stats.risk > 50 ? 'bad' : ''}">${Math.round(s.stats.risk)}%</b></div>
        <div class="kv"><span>Withdrawal</span><b class="${s.stats.withdrawal > 50 ? 'bad' : ''}">${Math.round(s.stats.withdrawal)}%</b></div>
        <div class="kv"><span>Hospital bill</span><b class="${l.debt.hospital ? 'bad' : 'creditv'}">${money(l.debt.hospital || 0)}</b></div>
      </div>
      ${this.courseCard()}
      <div class="row row--wrap">
        <button class="btn btn--sm btn--primary" data-act="clincheck" ${checkedToday ? 'disabled' : ''}>CHECK IN (FREE)</button>
        <button class="btn btn--sm" data-act="clingo">WALK TO THE CLINIC</button>
      </div>
      <div class="tiny mono-dim">The clinic is the pale building at the east end of Kestrel Street, past Habib's. Check-in is free, once a day. Treatment is ${money(info.cost)}; if you cannot pay it goes on the bill and the bill grows.</div>
      ${this.footer()}`;
  }

  /** The outpatient course, as the clinic app shows it. Appointments happen at the clinic. */
  courseCard() {
    const p = clinic.programInfo(this.g);
    if (p.status === 'none' && !p.eligible) return '';
    const label = { none: 'not enrolled', active: `session ${p.done} of ${p.sessions} done`, completed: 'completed', dropped: `dropped · back in day ${p.waitUntil}` }[p.status];
    return `<div class="card">
      <div class="kv"><span>Outpatient course</span><b class="${p.status === 'dropped' ? 'bad' : p.status === 'completed' ? 'creditv' : ''}">${label}</b></div>
      ${p.status === 'active' ? `<div class="kv"><span>Next appointment</span><b>${p.dueToday ? 'today' : `day ${p.next}`} · 10:00-16:00</b></div>
      <div class="kv"><span>Missed</span><b class="${p.missed ? 'bad' : ''}">${p.missed} · ${CONFIG.clinic.program.missAllowance} forgiven</b></div>` : ''}
      <div class="tiny mono-dim">${p.status === 'active' ? 'Appointments are kept in person at the clinic counter.' : p.canEnroll ? 'Sign up at the clinic counter. Five sessions, every other day, $35 each.' : ''}</div>
    </div>`;
  }

  /* ------------------------------ ACTIONS ------------------------------ */

  get actions() {
    const g = this.g;
    const s = g.state;
    return {
      ...siteActions(g, s),
      go(arg) { this.app = arg; this.msgId = null; },
      pay(arg) { g.payBill(arg); },
      work() { if (g.world?.areaId !== 'street') { g.toast('You have to be at the store to clock in.', 'info'); return; } const ok = workShift(g); if (ok) this.close(); },
      callout() { const ok = callOut(g); if (ok) this.close(); },
      quit() { g.openModal({ kicker: 'QUIK-STOP', title: 'Quit?', body: 'Dale will say "okay" before you finish the sentence. No severance. No reference. No job.', choices: [{ label: 'Quit.', effect: () => quitJob(g) }, { label: 'Stay.', effect: () => {} }] }); },
      rehire() { const ok = applyForJob(g); },
      oddjob(arg) { g.advance(20); const ok = doOddJob(g, arg); if (ok) this.close(); },
      bidpick(arg) { this.bidItem = arg; this.bidPrice = CONFIG.items[arg].value; },
      bidcancel() { this.bidItem = null; },
      bidprice(arg, num, elem) { this.bidPrice = Number(elem.value); },
      bidconfirm(arg) { listItem(g, arg, this.bidPrice ?? CONFIG.items[arg].value); this.bidItem = null; },
      cancelbid(arg) { cancelListing(g, arg); },
      grabbag() { buyGrabBag(g); },
      buyfood(arg) { buyFood(g, arg, 1, false); },
      buycredit(arg) { buyFood(g, arg, 1, true); },
      applycrp() { applyForCRP(g); },
      recert() { recertCRP(g); },
      utility() { claimUtilityGrant(g); },
      // arg is a thread key (a contact); an old message id still opens that message's thread
      msgopen(arg) {
        const byId = s.messages.find((x) => x.id === arg);
        this.msgId = byId ? threadKeyOf(byId) : arg;
        for (const m of s.messages) if (threadKeyOf(m) === this.msgId) m.read = true;
        this.g.audio.sfx('ui');
      },
      // the reply chips come from the sender's category (systems/sms.js), and the chosen one is
      // applied there: a landlord text can settle the rent, a BidBay text can reprice listings,
      // and Mo never offers to "talk about this later" to an automated auction notice
      reply(arg, num) { sms.sendReply(g, s.messages.find((x) => x.id === arg), num); },
      msgback() { this.msgId = null; },
      // Rolo: the thread and the app both go through systems/dealer.js and nothing else
      dealersay(arg) { dealer.smsSend(g, arg); },
      wappick(arg) { this.wapProduct = arg; this.wapQty = this.wapQty || 1; },
      wapqty(arg, num) { this.wapQty = Math.max(1, Math.min(dealer.DEALER.maxQty, (this.wapQty || 1) + (num || 0))); },
      waporder() {
        if (dealer.activeOrder(s) || this.wapBusy) return; // one order at a time, one tap per order
        this.wapBusy = true;
        const res = dealer.placeOrder(g, this.wapProduct, this.wapQty || 1, 'app');
        this.wapBusy = false;
        this.wapNote = res.ok ? '' : res.reason;
      },
      wapcancel() { dealer.cancelOrder(g, 'cancelled in the app'); },
      // put the phone away first, so the bite happens on screen
      eatitem(arg) { this.close(); eat(g, arg); },
      useitem(arg) {
        const def = CONFIG.items[arg];
        g.openModal({
          kicker: 'INVENTORY',
          title: def ? def.name : arg,
          body: 'This is a fictional substance that exists only in this game.\n\nUsing it raises addiction and risk. Risk at the ceiling is an overdose and a night in the ER. Your tolerance blunts the effect each time, so the same dose does less and costs more.',
          choices: [
            { label: 'Use it.', sub: 'risk +' + (CONFIG.substances.types[arg]?.risk ?? 0), effect: () => useSubstance(g, arg) },
            { label: 'Put it back.', effect: () => {} },
          ],
        });
      },
      listitem(arg) { this.bidItem = arg; this.bidPrice = CONFIG.items[arg].value; this.app = 'bidbay'; },
      sleep(arg, num) { sleep(g, num ?? 7); this.close(); },
      feedpost(text) {
        g.advance(10);
        s.feedPosts = s.feedPosts || [];
        const p = { text, likes: Math.floor(Math.random() * 8) + s.social.followers, replies: Math.floor(Math.random() * 3), day: dayOf(s.clock.m), typed: true };
        p.likedBy = social.likesForMoPost(g);
        p.likes += p.likedBy.length;
        s.feedPosts.push(p);
        if (s.feedPosts.length > 24) s.feedPosts.shift();
        bump(s, 'morale', CONFIG.social.postMorale);
        s.social.followers += Math.floor(Math.random() * 2);
        return p;
      },
      posttyped() {
        const box = this.body?.querySelector('#feedtext');
        const text = String(box?.value || '').replace(/\s+/g, ' ').trim().slice(0, 140);
        if (!text) { g.toast('FeedLove: say something. Anything. Even "hi".', 'info'); return; }
        if (box) box.value = '';
        this.actions.feedpost.call(this, text);
        g.toast('Posted.', 'good');
      },
      likepost(arg) {
        const p = social.timeline(s).find((x) => x.id === arg);
        if (p) social.likePost(g, p);
      },
      follow(arg, num) { social.follow(g, arg, num !== 0); },
      post() {
        g.advance(10);
        s.feedPosts = s.feedPosts || [];
        const texts = [
          'day 4 of trying. no specifics. just trying.',
          'the radiator and i have reached an understanding',
          'sold my tv. watching the wall now. wall is fine.',
          'new leaf. same tree. different leaf.',
          'does anyone else hear the fridge or is it just me and the fridge',
          'got a job. had a job. have a job. tense unknown.',
          'feeling normal. this is a lie but it is a nice one.',
        ];
        const p = { text: pick(texts), likes: Math.floor(Math.random() * 8) + s.social.followers, replies: Math.floor(Math.random() * 3), day: dayOf(s.clock.m) };
        p.likedBy = social.likesForMoPost(g);
        p.likes += p.likedBy.length;
        s.feedPosts.push(p);
        if (s.feedPosts.length > 24) s.feedPosts.shift();
        bump(s, 'morale', CONFIG.social.postMorale);
        s.social.followers += Math.floor(Math.random() * 2);
        if (chance(CONFIG.social.backlashChance)) {
          bump(s, 'morale', CONFIG.social.backlashMorale);
          bump(s, 'stress', 4);
          g.toast('Someone replied "cool" and you have thought about it for nine minutes.', 'bad');
        } else {
          g.toast('Posted. Three likes. One of them is your mother.', 'good');
        }
        if (chance(CONFIG.social.donationChance)) {
          g.earnMoney(CONFIG.social.donationAmount, 'FeedLove tip');
          g.toast('A stranger sent you $12 with the note "get well soon".', 'event');
        }
      },
      govisit() {
        this.close();
        g.openModal({
          kicker: 'TRAVEL',
          title: 'The Golden Fellowship',
          body: 'It is a fifteen-minute walk, or a bus you do not have the exact change for.',
          choices: [
            { label: 'Walk there now. (20 min)', effect: () => { g.advance(20); g.goTo('church', 'phone'); g.visitFellowship?.(); } },
            { label: 'Not right now.', effect: () => {} },
          ],
        });
      },
      textaddison() {
        g.advance(5);
        pushMessage(g, {
          from: 'ADDISON OCTAVIUS',
          subject: 'Re: your message',
          body: 'Friend — I read it twice. Once for the words and once for the things you did not say, which is where the truth usually lives.\n\nThe door is open. The coffee is warm. My calendar is, as ever, generously empty for you.',
        });
        g.toast('Addison replies within a minute. Always a minute.', 'event');
      },
      theme(arg) { g.setTheme?.(arg); },
      scale(arg, num) { g.setScale?.(num); },
      camdist(arg, num, elem) { g.setCamera?.('dist', elem ? elem.value : 100); },
      camheight(arg, num, elem) { g.setCamera?.('height', elem ? elem.value : 100); },
      camreset() { g.setCamera?.('reset'); },
      togglecrt() { g.toggleCRT(); },
      toggle43() { g.toggle43(); },
      volume(arg, num, elem) { g.setMusicVolume?.(elem ? Number(elem.value) / 100 : s.settings.volume); },
      sfxvolume(arg, num, elem) { g.setSfxVolume?.(elem ? Number(elem.value) / 100 : (s.settings.sfxVolume ?? 0.5)); },
      mute() { g.setMuted?.(!s.settings.muted); },
      save(arg) { g.saveSlot(Number(arg)); },
      load(arg) { g.loadSlot(Number(arg)); this.close(); },
      quitmenu() { this.close(); g.quitToMenu(); },
      clinic() { clinic.checkIn(g); },
      clincheck() { clinic.checkIn(g); },
      feedtab(arg) { this.feedTab = arg; this.heartNote = ''; },
      hookup(arg) { this.close(); dating.hookupMenu(g, arg); },
      blocktab(arg) { this.blockTab = arg; },
      autopay() { setAutopay(g, !s.autopay?.on); g.toast(s.autopay.on ? 'Shale Pay AutoPay is on.' : 'AutoPay is off. Every bill is yours again.', 'info'); },
      casgame(arg) { this.casinoGame = arg; },
      casbet(arg, num) { this.casinoBet = num; },
      casspin() { this.casLast = casino.spin(g, this.casinoBet || CONFIG.casino.bets[0]) || this.casLast; },
      casdeal() { this.bj = casino.deal(g, this.casinoBet || CONFIG.casino.bets[0]) || this.bj; },
      cashit() { casino.hit(g, this.bj); },
      casstand() { casino.stand(g, this.bj); },
      casdouble() { casino.double(g, this.bj); },
      casrl(arg) { this.rlLast = casino.roulette(g, this.casinoBet || CONFIG.casino.bets[0], arg) || this.rlLast; },
      openlove() { this.app = 'social'; this.msgId = null; this.feedTab = 'love'; },
      openhearts() { this.app = 'social'; this.msgId = null; this.feedTab = 'hearts'; this.heartNote = ''; },
      heart(arg) {
        const res = dating.sendHeart(g, arg);
        if (res.ok) this.heartNote = res.result === 'match' ? `It's a match. ${res.line}` : res.line;
      },
      dmchat(arg) {
        const res = romance.chat(g, arg);
        if (res) this.heartNote = `${res.name}: ${res.line.replace(/^"|"$/g, '')}`;
      },
      dmdate(arg) { this.close(); romance.openDateMenu(g, arg); },
      clingo() { this.close(); g.advance(15); g.goTo('clinic', 'phone'); },
      rentahead() { const r = rent.payRent(g, { ahead: true }); if (!r.ok && r.reason !== 'nothing due') g.audio.sfx('deny'); },
      datechat(arg) { const r = romance.chat(g, arg); if (r) g.toast(`${r.name}: ${r.line}`, 'info'); },
      dateflirt(arg) { const r = romance.flirt(g, arg); if (r?.ok) g.toast(`${r.name}: ${r.line}`, r.delta > 0 ? 'good' : 'bad'); },
      datedate(arg) { this.close(); romance.openDateMenu(g, arg); },
      dateskin(arg) { romance.askGirlfriend(g, arg); },
      datemove(arg) { romance.askMoveIn(g, arg); },
      paydebt(arg, num) { life.payDebt(g, num === 0 ? life.totalDebt(s) : num); },
      rehouse() { if (life.rehouse(g)) this.close(); },
      closebook() {
        const id = epilogueFor(g);
        g.openModal({
          kicker: 'CLOSE THE BOOK',
          title: 'End Mo\'s Story Here?',
          body: `Nothing forces this. Mo's life would go on tomorrow, worse or better.\n\nIf you stop here, his story closes as: ${(ENDINGS[id] || {}).title || id}.`,
          choices: [
            { label: 'Close it here.', effect: () => { this.close(); g.finishEnding(id); } },
            { label: 'Not yet. There is a tomorrow.', effect: () => {} },
          ],
        });
      },
    };
  }

  get apps() {
    return {
      invest: this.investView,
      ride: this.rideView,
      shop: this.shopView,
      tube: this.tubeView,
      board: this.boardView,
      xxx: this.xxxView,
      web: this.webView,
      home: this.homeView,
      bank: this.bankView,
      jobs: this.jobsView,
      bidbay: this.bidbayView,
      pantry: this.pantryView,
      messages: this.messagesView,
      inventory: this.inventoryView,
      bills: this.homeBillsView,
      calendar: this.calendarView,
      social: this.socialView,
      fellowship: this.fellowshipView,
      system: this.systemView,
      dealer: this.dealerView,
      rolo: this.roloView,
      dates: this.datesView,
      block: this.blockView,
      casino: this.casinoView,
      clinic: this.clinicView,
    };
  }
}

/** Which epilogue fits Mo's life as it stands, for closing the book by choice. */
function epilogueFor(g) {
  const s = g.state;
  const st = s.stats;
  const L = life.lifeState(s);
  if (s.fellowship?.pledged || s.fellowship?.stage >= 5) return 'pledge';
  if (L.housing === 'evicted') return 'evicted';
  if (!s.job.employed && s.job.fired) return 'terminated';
  if (st.addiction <= 22 && st.morale >= 55 && st.risk < 30) return 'lucid';
  if (st.addiction <= 42 && st.morale >= 48) return 'steady';
  if (st.morale < 15) return 'empty';
  if (billInfo(g, 'rent').owedCycles === 0 && s.job.employed) return 'functional';
  return 'quiet';
}

// the newer screens (TradeHarder, Amazin', the laptop's sites) live in sites.js
installSites(Phone);
