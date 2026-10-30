/** The smartphone: the primary management interface. Every button does something. */
import { CONFIG, DAY_NAMES } from '../core/config.js';
import { money, hhmm, dayOf, minuteOfDay, duration, clamp } from '../core/util.js';
import { clock, inventoryList, countItem, pushMessage, hasItem, unreadMessages } from '../core/state.js';
import { bump } from '../core/state.js';
import { billInfo, payBill, buyFood, applyForCRP, recertCRP, claimUtilityGrant, listItem, cancelListing, buyGrabBag, GROCERY } from '../systems/economy.js';
import { eat, useSubstance, sleep, soberUp } from '../systems/needs.js';
import { shiftInfo, doOddJob, oddJobsAvailable, applyForJob, quitJob, callOut, workShift } from '../systems/jobs.js';
import { fellowshipStage, serviceWindow } from '../systems/fellowship.js';
import { el, esc as _esc, chance, pick, clamp as _clamp } from '../core/util.js';

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
    this.app = appId || 'home';
    this.wrap = el(`<div class="phone-wrap"><div class="phone">
      <div class="phone__notch"><i></i></div>
      <div class="phone__bar"><span data-live="clock">--:--</span><span class="spacer"></span><span data-live="money">$0</span></div>
      <div class="phone__body"></div>
      <div class="phone__nav">
        <button data-nav="home">HOME</button>
        <button data-nav="bank">BANK</button>
        <button data-nav="messages">MSGS</button>
        <button data-nav="pantry">FOOD</button>
        <button data-nav="close">CLOSE</button>
      </div>
    </div></div>`);
    this.body = this.wrap.querySelector('.phone__body');
    this.wrap.addEventListener('click', (e) => this.onClick(e));
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
    const act = action.dataset.act;
    const arg = action.dataset.arg;
    const num = action.dataset.num !== undefined ? Number(action.dataset.num) : undefined;
    const fn = this.actions[act];
    if (!fn) { console.warn('[phone] no action', act); return; }
    this.g.audio.sfx('ui');
    fn.call(this, arg, num, action);
    if (this.wrap) this.render();
  }

  render() {
    if (!this.wrap) return;
    const s = this.g.state;
    const c = clock(s);
    this.wrap.querySelector('[data-live="clock"]').textContent = `${c.hhmm} · D${c.day}`;
    this.wrap.querySelector('[data-live="money"]').textContent = money(s.money);
    const view = this.apps[this.app] ? this.apps[this.app].call(this) : this.homeView();
    this.body.innerHTML = view;
    this.body.scrollTop = 0;
  }

  header(title, kicker = '') {
    return `<div class="papp">
      <div class="app__header">
        <button class="app__back" data-nav="home">◀</button>
        <span class="app__title">${T(title)}</span>
        ${kicker ? `<span class="spacer"></span><span class="tiny mono-dim">${T(kicker)}</span>` : ''}
      </div>
      <div class="app__body">`;
  }
  footer() { return '</div></div>'; }

  /* ------------------------------ HOME ------------------------------ */

  homeView() {
    const s = this.g.state;
    const apps = [
      ['messages', '✉', 'Messages', unreadMessages(s)],
      ['bank', '$', 'Banking', 0],
      ['jobs', '≡', 'Employment', 0],
      ['bidbay', '◈', 'BidBay', s.listings.length],
      ['calendar', '▦', 'Calendar', 0],
      ['pantry', '▤', 'Pantry', s.crp.suspended ? 1 : 0],
      ['inventory', '▣', 'Inventory', 0],
      ['bills', '⌂', 'Rent & Bills', billInfo(this.g, 'rent').owedCycles > 0 ? 1 : 0],
      ['social', '◎', 'FeedLove', 0],
      ['fellowship', '✝', 'Fellowship', s.fellowship.stage > 0 && s.fellowship.stage < 5 ? 1 : 0],
      ['system', '⚙', 'System', 0],
    ];
    return `${this.header('MoPhone OS', 'v0.9')}
      <div class="phone__home">
        ${apps.map(([id, icon, name, badge]) => `
          <button class="appbtn" data-act="go" data-arg="${id}">
            <span class="appbtn__icon">${icon}</span>
            <span class="appbtn__name">${name}${badge ? ` <span class="notif">●</span>` : ''}</span>
          </button>`).join('')}
      </div>
      <div class="hr"></div>
      <div class="kv"><span class="mono-dim">Fit for the day</span><b>${s.stats.energy > 55 ? 'Roughly' : s.stats.energy > 25 ? 'Barely' : 'No'}</b></div>
      <div class="kv"><span class="mono-dim">Next obligation</span><b>${this.nextObligation()}</b></div>
      <div class="hr"></div>
      <div class="tiny mono-dim">Signal: ${s.flags.phoneLate ? 'degraded (bill overdue)' : 'weak but honest'}</div>
      ${this.footer()}`;
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

    return `${this.header('Banking', 'SHALE BANK')}
      <div class="card">
        <div class="tiny mono-dim">AVAILABLE BALANCE</div>
        <div style="font-size:26px;letter-spacing:.04em" class="${s.money < 30 ? 'bad' : 'creditv'}">${money(s.money)}</div>
        <div class="tiny mono-dim">Overdraft: none. Bank policy: "we are not a charity, we are a bank" — the difference is marketing.</div>
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
    return `${this.header('Employment', 'CASH TODAY')}
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
    return `${this.header('Pantry', crp.active ? `CREDIT ${money(crp.credit)}` : 'CASH')}
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
          return `<div class="listitem">
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
      const m = s.messages.find((x) => x.id === this.msgId);
      if (!m) { this.msgId = null; return this.messagesView(); }
      m.read = true;
      return `${this.header(m.from, `D${m.day}`)}
        <div class="app__h">${T(m.subject)}</div>
        <div style="white-space:pre-line;font-size:12px;line-height:1.7">${T(m.body)}</div>
        <div class="hr"></div>
        <button class="btn btn--ghost" data-act="msgback">◀ BACK TO INBOX</button>
        ${this.footer()}`;
    }
    const unread = unreadMessages(s);
    return `${this.header('Messages', `${unread} NEW`)}
      <div class="list">
        ${s.messages.length ? s.messages.map((m) => `
          <button class="listitem" data-act="msgopen" data-arg="${m.id}" style="text-align:left;cursor:pointer;width:100%">
            <div class="grow">
              <div class="name">${m.read ? '' : '<span class="bad">● </span>'}${T(m.from)}</div>
              <div class="meta">${T(m.subject)} · D${m.day}</div>
            </div>
          </button>`).join('') : '<div class="empty">No messages. Everyone is giving you space. That is what that is.</div>'}
      </div>
      ${this.footer()}`;
  }

  /* ------------------------------ INVENTORY ------------------------------ */

  inventoryView() {
    const s = this.g.state;
    const items = inventoryList(s);
    return `${this.header('Inventory', `${items.length} ITEMS`)}
      <div class="list">
        ${items.length ? items.map((i) => {
          const def = i.def;
          let buttons = '';
          if (def.kind === 'food') buttons = `<button class="btn btn--sm" data-act="eatitem" data-arg="${i.id}">EAT</button>`;
          else if (def.kind === 'substance') buttons = `<button class="btn btn--sm btn--danger" data-act="useitem" data-arg="${i.id}">USE</button>`;
          else if (def.kind === 'valuable') buttons = `<button class="btn btn--sm" data-act="listitem" data-arg="${i.id}">SELL</button>`;
          return `<div class="listitem">
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
    return `${this.header('Rent & Utilities', 'UNIT 3B')}
      ${block(rent, `<div class="tiny ${s.flags.evictionNotice ? 'bad' : 'mono-dim'}">${s.flags.evictionNotice ? 'EVICTION NOTICE POSTED. Two missed cycles ends the lease — and the run.' : `Lease: week to week. Landlord: Rae Vell. Missed cycles: ${s.bills.rent.missed}.`}</div>`)}
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
      ].join(' ');
      rows.push(`<div class="listitem">
        <div class="grow"><div class="name">${DAY_NAMES[wd]} — Day ${d}${i === 0 ? ' (today)' : ''}</div><div class="meta">${tags || '&nbsp;'}</div></div>
        <span class="tiny mono-dim">${i === 0 ? hhmm(s.clock.m) : ''}</span>
      </div>`);
    }
    return `${this.header('Calendar', `DAY ${day}`)}
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
    return `${this.header('FeedLove', `${s.social.followers} FOLLOWERS`)}
      <div class="card">
        <div class="tiny mono-dim">YOU ARE @mofunctional</div>
        <div class="tiny">${T(s.feedBio || 'not really a brand. a person. mostly.')}</div>
      </div>
      <button class="btn btn--primary" data-act="post">POST SOMETHING (10 MIN)</button>
      <div class="app__h">Your posts</div>
      <div class="list">
        ${posts.length ? posts.slice(-6).reverse().map((p) => `
          <div class="listitem"><div class="grow"><div class="name">${T(p.text)}</div><div class="meta">${p.likes} likes · ${p.replies} replies · D${p.day}</div></div></div>`).join('') : '<div class="empty">You have never posted. This is probably correct.</div>'}
      </div>
      <div class="tiny mono-dim">Posting costs 10 minutes and may produce: one like, one insult, or an unexpected $12 from a stranger.</div>
      ${this.footer()}`;
  }

  /* ------------------------------ FELLOWSHIP ------------------------------ */

  fellowshipView() {
    const s = this.g.state;
    const st = fellowshipStage(s);
    const win = serviceWindow(this.g);
    return `${this.header('The Golden Fellowship', 'SALT & GOLD')}
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
    return `${this.header('System', 'SETTINGS')}
      <div class="row row--wrap">
        <button class="btn btn--sm ${s.settings.crt ? 'on btn--primary' : ''}" data-act="togglecrt">CRT: ${s.settings.crt ? 'ON' : 'OFF'}</button>
        <button class="btn btn--sm ${s.settings.ratio43 ? 'btn--primary' : ''}" data-act="toggle43">4:3: ${s.settings.ratio43 ? 'ON' : 'OFF'}</button>
      </div>
      <div class="app__h">Volume</div>
      <input type="range" min="0" max="100" value="${Math.round(s.settings.volume * 100)}" data-act="volume" style="width:100%" />
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
      </div>
      ${this.footer()}`;
  }

  /* ------------------------------ ACTIONS ------------------------------ */

  get actions() {
    const g = this.g;
    const s = g.state;
    return {
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
      msgopen(arg) { this.msgId = arg; const m = s.messages.find((x) => x.id === arg); if (m) m.read = true; },
      msgback() { this.msgId = null; },
      eatitem(arg) { eat(g, arg); },
      useitem(arg) {
        const def = CONFIG.items[arg];
        g.openModal({
          kicker: 'INVENTORY',
          title: def ? def.name : arg,
          body: 'This is a fictional substance that exists only in this game.\n\nUsing it raises addiction and risk. Risk at 100 ends the run. Your tolerance blunts the effect each time, so the same dose does less and costs more.',
          choices: [
            { label: 'Use it.', sub: 'risk +' + (CONFIG.substances.types[arg]?.risk ?? 0), effect: () => useSubstance(g, arg) },
            { label: 'Put it back.', effect: () => {} },
          ],
        });
      },
      listitem(arg) { this.bidItem = arg; this.bidPrice = CONFIG.items[arg].value; this.app = 'bidbay'; },
      sleep(arg, num) { sleep(g, num ?? 7); this.close(); },
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
      togglecrt() { g.toggleCRT(); },
      toggle43() { g.toggle43(); },
      volume(arg, num, elem) { s.settings.volume = Number(elem.value) / 100; g.audio.setVolume(s.settings.volume); },
      save(arg) { g.saveSlot(Number(arg)); },
      load(arg) { g.loadSlot(Number(arg)); this.close(); },
      quitmenu() { this.close(); g.quitToMenu(); },
    };
  }

  get apps() {
    return {
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
    };
  }
}


