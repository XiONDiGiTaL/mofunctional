/**
 * The newer screens, shared by the phone and the laptop (the Laptop is a Phone with a different
 * shell, so every view here works on both):
 *
 *   invest  TradeHarder — stocks and property (systems/market.js)
 *   shop    Amazin'     — buy things, delivered tomorrow (systems/shop.js)
 *   tube    MeTube      — videos and memes from 1999 to scroll through, for time and morale
 *   board   Kestrel Underground — an anonymous message board: lore, rumours about the block, the cult
 *   xxx     DialUpDelights — adult site, every model behind a mosaic; Mo's mood goes up a little
 *   web     the laptop's start page (Netscrape)
 *
 * installSites(Phone) adds the views to the class; siteActions() returns their click handlers.
 */
import { CONFIG } from '../core/config.js';
import { money, dayOf, pick } from '../core/util.js';
import { bump } from '../core/state.js';
import * as market from '../systems/market.js';
import * as shop from '../systems/shop.js';
import * as block from '../systems/block.js';
import * as health from '../systems/health.js';
import { STRANGER_BY_ID } from '../core/strangers.js';
import { itemIcon } from './icons.js';

const T = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rng(seed) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------------ content */

const VIDEOS = [
  ['dancing baby (3D) EXTENDED REMIX', 'the baby has been dancing since 1996. the baby will never stop.', 'baby'],
  ['cat falls off TV (slow motion)', 'filmed on a camcorder by somebody laughing too hard to hold it', 'cat'],
  ['HOW TO PROGRAM YOUR VCR (2 HOURS)', 'a man in a sweater, the most patient man alive', 'vcr'],
  ['Y2K: what you NEED to know', 'a guy in a bunker with 400 cans of beans and a webcam', 'bunker'],
  ['bodega cat compilation vol. 4', 'every bodega cat in the five boroughs, ranked (Gato is #2, robbed)', 'cat'],
  ['MAN VS SUBWAY DOORS', 'he does not win', 'subway'],
  ['hampster dance but it never ends', 'it does not end', 'hamster'],
  ['Pastor Addison: "Your Gold Is Waiting" (FULL SERMON)', '2,000,000 views. the comments are turned off.', 'church'],
  ['guy tries every slushie flavor at a Quik-Stop', 'he is Kev. this is Kev. Kev has a channel.', 'slushie'],
  ['all your base are belong to us', 'nobody knows what it means. it is everywhere.', 'base'],
  ['pigeon steals a whole bagel', 'the bagel is bigger than the pigeon. the pigeon does not care.', 'pigeon'],
  ['"im on a boat" (ray from 2A, unauthorized)', 'filmed through a door on Kestrel by Denise. Ray does not know.', 'boat'],
];
const THUMB = { baby: '#d8a07a', cat: '#c8823a', vcr: '#3a4a6a', bunker: '#5a6a3a', subway: '#8a8a3a', hamster: '#e0b06a', church: '#d8b040', slushie: '#e04a8a', base: '#2a2a3a', pigeon: '#8a8a90', boat: '#3a7ab0' };

const BOARD_THREADS = [
  { title: 'anyone else think the Golden Fellowship is a pyramid scheme', by: 'n0tAsheep', replies: [
    'it is not a pyramid. it is a triangle with a better logo.',
    'my cousin joined. now she owns 40 tote bags and no couch.',
    'they gave me a free coffee and i woke up tithing. be careful.',
    'Addison Octavius isn\'t even his real name. it was Addison something on a parking ticket from 1987.',
  ] },
  { title: 'who is the guy in the alley at night (Kestrel)', by: 'kestrel_watch', replies: [
    'Dex. he\'s fine. his product is not.',
    'only after six. never in the day. like a vampire with a pager.',
    'he owes my brother $20. it\'s on the wall at the lot now.',
  ] },
  { title: 'RATE YOUR BODEGA (brooklyn edition)', by: 'BECorDie', replies: [
    'Miguel\'s on Kestrel. 10/10. the cat judges you, which is correct.',
    'Habib\'s is not a bodega it is a religious experience',
    'Quik-Stop #14: coffee 1.25, vibes 0, open 24 hrs, staff dead inside (affectionate)',
  ] },
  { title: 'Y2K is going to end everything, prove me wrong', by: 'canned_goods_99', replies: [
    'the clocks will roll over and we will all be exactly as broke as before.',
    'bought Y2KS stock. not because i believe. because other people believe.',
    'my radiator has never worked. it is Y2K compliant by default.',
  ] },
  { title: 'what happened at Quik-Stop #14 in 1996', by: 'anonymous', replies: [
    'nobody talks about the night of the slushie machine.',
    'Dale was there. Dale will not talk about it. Dale has a look.',
    'i heard it involved a raccoon and a lottery ticket. i heard it won.',
  ] },
  { title: 'the walk-up at 1104 — any landlord drama?', by: 'renter4life', replies: [
    'the owner is "some company." nobody has ever seen the owner. the super is Hector and Hector is a saint.',
    'if anyone buys that building please fix the boiler. that is all. that is the post.',
    'Squeak in 4A sells out of his coat. everyone knows. the coat knows.',
  ] },
  { title: 'Gus by the bodega was an umpire??', by: 'minor_league_fan', replies: [
    'yes. 1981. called a guy out who is a dentist now. the dentist still sends him a card.',
    'Gus remembers everyone\'s name. EVERYONE. it is a little scary and a little beautiful.',
  ] },
  { title: 'best date spot in BK on a budget', by: 'broke_romantic', replies: [
    'Lucia\'s on Ashby if you have $50. Habib\'s if you have $28. the park if you have charm.',
    'the roof at 1104 at night. you didn\'t hear it from me.',
    'not a Quik-Stop. i tried. she left.',
  ] },
];

/* ------------------------------------------------------------------ views */

const VIEWS = {
  /** TradeHarder: stocks and, with money enough, property. */
  investView() {
    const s = this.g.state;
    const tab = this.investTab || 'stocks';
    const day = dayOf(s.clock.m);
    const m = market.marketState(s);
    const tabBtn = (id, label) => `<button class="${tab === id ? 'on' : ''}" data-act="invtab" data-arg="${id}">${label}</button>`;
    let body = '';
    if (tab === 'stocks') {
      const qty = this.invQty || 1;
      body = `<div class="cas__bets inv__qty">${[1, 10, 100].map((q) => `<button class="${q === qty ? 'on' : ''}" data-act="invqty" data-num="${q}">×${q}</button>`).join('')}</div>`
        + market.STOCKS.map((st) => {
          const hist = market.history(s, st.sym, day);
          const p = hist[hist.length - 1];
          const prev = hist[hist.length - 2] ?? st.p0;
          const ch = (p - prev) / prev;
          const h = m.holdings[st.sym];
          const last = hist.slice(-14);
          const lo = Math.min(...last), hi = Math.max(...last);
          const pts = last.map((v, i) => `${(i / Math.max(1, last.length - 1)) * 60},${18 - ((v - lo) / Math.max(0.01, hi - lo)) * 16}`).join(' ');
          return `<div class="inv__row">
            <div class="grow"><b>${st.sym}</b> <span class="tiny mono-dim">${T(st.name)}</span><div class="tiny mono-dim">${T(st.blurb)}${h ? ` · you own ${h.qty} (avg ${money(h.cost / h.qty)})` : ''}</div></div>
            <svg class="inv__spark" viewBox="0 0 60 20"><polyline points="${pts}" fill="none" stroke="${ch >= 0 ? '#5ae07a' : '#ff5a5a'}" stroke-width="1.6"/></svg>
            <div class="inv__px"><b>${money(p)}</b><span class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '▲' : '▼'} ${(Math.abs(ch) * 100).toFixed(1)}%</span></div>
            <div class="inv__btns"><button class="btn btn--sm btn--primary" data-act="invbuy" data-arg="${st.sym}" ${s.money >= p * qty + CONFIG.market.fee ? '' : 'disabled'}>BUY</button>
            <button class="btn btn--sm" data-act="invsell" data-arg="${st.sym}" ${h && h.qty >= qty ? '' : 'disabled'}>SELL</button></div>
          </div>`;
        }).join('');
      const pv = market.portfolioValue(s);
      body = `<div class="card inv__sum">Portfolio ${money(pv)} · realized ${m.realized >= 0 ? '+' : ''}${money(m.realized)} · $${CONFIG.market.fee} a trade · prices move once a day</div>${body}`;
    } else {
      body = Object.values(market.PROPERTIES).map((p) => {
        const own = m.properties[p.id];
        if (!own) {
          return `<div class="card inv__prop"><b>${T(p.name)}</b><div class="tiny">${T(p.blurb)}</div>
            <div class="tiny mono-dim">${p.units ? `${p.units} units × ${money(p.rent)}/wk` : `${money(p.flat)}/wk flat`} · upkeep ${money(p.upkeep)}/wk</div>
            <button class="btn btn--primary btn--sm" data-act="invprop" data-arg="${p.id}" ${s.money >= p.price ? '' : 'disabled'}>BUY · ${money(p.price)}</button></div>`;
        }
        const rows = own.units.map((u, i) => `<div class="listitem"><div class="grow"><div class="name">${T(u.name)}</div><div class="meta">${{ paying: 'paying', behind: `behind ${u.behind} wk`, vacant: 'vacant', offer: 'wants to pay in product', product: 'paying in product' }[u.status]}</div></div>
          ${u.status === 'behind' ? `<button class="btn btn--sm" data-act="invten" data-arg="${i}" data-num="0">A CHANCE</button><button class="btn btn--sm" data-act="invten" data-arg="${i}" data-num="1">EVICT</button>` : ''}
          ${u.status === 'vacant' ? `<button class="btn btn--sm btn--primary" data-act="invten" data-arg="${i}" data-num="2">LIST · ${money(CONFIG.market.listingCost)}</button>` : ''}
          ${u.status === 'offer' ? `<button class="btn btn--sm" data-act="invten" data-arg="${i}" data-num="3">ACCEPT</button><button class="btn btn--sm" data-act="invten" data-arg="${i}" data-num="4">CASH ONLY</button>` : ''}
        </div>`).join('');
        return `<div class="card inv__prop"><b>${T(p.name)}</b> <span class="pill">yours</span><div class="tiny mono-dim">since day ${own.since} · earned ${money(own.income)} so far · next rent day ${own.lastPaidDay + 7}</div>${rows ? `<div class="list">${rows}</div>` : ''}</div>`;
      }).join('') + `<div class="tiny mono-dim">Weekly net from what you own: ${money(market.weeklyIncome(s))}.</div>`;
    }
    return `${this.header('TradeHarder', money(s.money))}
      <div class="feedtabs feedtabs--inv">${tabBtn('stocks', 'STOCKS')}${tabBtn('property', 'PROPERTY')}</div>
      ${body}
      <div class="tiny mono-dim">Past performance is not a promise. Neither is present performance.</div>
      ${this.footer()}`;
  },

  /** Amazin': order things; they arrive tomorrow by the door. */
  shopView() {
    const s = this.g.state;
    const sh = shop.shopState(s);
    const items = shop.catalog();
    return `${this.header("Amazin'", money(s.money))}
      ${sh.orders.length ? `<div class="card">On the way: ${T(sh.orders.map((o) => CONFIG.items[o.id]?.name).join(', '))} · arrives tomorrow</div>` : ''}
      <div class="shop__grid">${items.map((it) => `<div class="shop__item">
        ${itemIcon(it.id, it.kind)}
        <div class="tiny"><b>${T(it.name)}</b></div>
        <div class="tiny mono-dim">${money(it.price)}</div>
        <button class="btn btn--sm btn--primary" data-act="shopbuy" data-arg="${it.id}" ${s.money >= it.price + CONFIG.shop.shipping ? '' : 'disabled'}>BUY</button>
      </div>`).join('')}</div>
      <div class="tiny mono-dim">Shipping ${money(CONFIG.shop.shipping)} an order. Next-day delivery to Unit 3B. Prices are retail; BidBay paid you less for the same thing, and that is the business model.</div>
      ${this.footer()}`;
  },

  /** MeTube: scroll, watch, lose half an hour. */
  tubeView() {
    const s = this.g.state;
    const day = dayOf(s.clock.m);
    const r = rng(day * 991 + 5);
    const list = VIDEOS.slice().sort(() => r() - 0.5).slice(0, 7);
    return `${this.header('MeTube', 'broadcast yourself (please don\'t)')}
      ${list.map(([title, desc, th]) => `<button class="tube__vid" data-act="tubewatch" data-arg="${T(title)}">
        <span class="tube__thumb" style="--c:${THUMB[th] || '#555'}"><i>▶</i><em>${Math.floor(1 + r() * 9)}:${String(Math.floor(r() * 60)).padStart(2, '0')}</em></span>
        <span class="tube__meta"><b>${T(title)}</b><span class="tiny mono-dim">${T(desc)}</span><span class="tiny mono-dim">${(1 + r() * 900).toFixed(0)}K views · RealPlayer required</span></span>
      </button>`).join('')}
      ${this.tubeNote ? `<div class="card dnote">${T(this.tubeNote)}</div>` : ''}
      ${this.footer()}`;
  },

  /** Kestrel Underground: an anonymous board. Read threads, post into them. */
  boardView() {
    const s = this.g.state;
    const i = this.boardThread;
    if (i !== undefined && i !== null) {
      const t = BOARD_THREADS[i];
      const mine = (s.boardPosts || []).filter((p) => p.thread === i);
      return `${this.header('Kestrel Underground', 'anon BBS')}
        <button class="btn btn--ghost btn--sm" data-act="boardback">◀ ALL THREADS</button>
        <div class="bbs__op"><b>${T(t.title)}</b><div class="tiny mono-dim">posted by ${T(t.by)}</div></div>
        ${t.replies.map((x, k) => `<div class="bbs__reply"><span class="tiny mono-dim">anon_${(i * 37 + k * 11) % 997}</span><div>${T(x)}</div></div>`).join('')}
        ${mine.map((p) => `<div class="bbs__reply bbs__reply--mine"><span class="tiny mono-dim">you (anon_1120)</span><div>${T(p.text)}</div>${p.answer ? `<div class="tiny">↳ ${T(p.answer)}</div>` : ''}</div>`).join('')}
        <div class="fcompose"><input id="boardtext" type="text" maxlength="160" placeholder="post anonymously…" autocomplete="off" spellcheck="false" /><button class="btn btn--primary btn--sm" data-act="boardpost" data-arg="${i}">POST</button></div>
        ${this.footer()}`;
    }
    return `${this.header('Kestrel Underground', 'anon BBS')}
      <div class="tiny mono-dim">est. 1997 · no names · no rules (one rule: no names)</div>
      ${BOARD_THREADS.map((t, k) => `<button class="bbs__thread" data-act="boardopen" data-num="${k}"><b>${T(t.title)}</b><span class="tiny mono-dim">${t.replies.length + (s.boardPosts || []).filter((p) => p.thread === k).length} replies · ${T(t.by)}</span></button>`).join('')}
      ${this.footer()}`;
  },

  /** DialUpDelights: blurred to the point of abstraction. It helps, a little. */
  xxxView() {
    const s = this.g.state;
    const r = rng(dayOf(s.clock.m) * 313 + (this.xxxPage || 0));
    const tiles = Array.from({ length: 6 }, () => {
      const cells = Array.from({ length: 36 }, () => `<i style="background:hsl(${18 + r() * 20},${30 + r() * 30}%,${30 + r() * 40}%)"></i>`).join('');
      return `<div class="xxx__tile"><div class="xxx__mosaic">${cells}</div><span class="tiny">${pick(['BRANDI_NYC', 'xXCandyXx', 'MissMidtown', 'LuvBug99', 'StatenIslandSweetie', 'Velvet_4U'])}</span></div>`;
    }).join('');
    return `${this.header('DialUpDelights', '18+ · loading 4%')}
      <div class="card xxx__warn">You are entering an ADULT site. You are an adult. The site is not sure it is.</div>
      <div class="xxx__grid">${tiles}</div>
      <button class="btn btn--primary" data-act="xxxbrowse">LOAD MORE (28.8k MODEM · 6 MIN)</button>
      <div class="tiny mono-dim">Every image is a mosaic. Every image takes four minutes to load. This is 1999.</div>
      ${this.footer()}`;
  },

  /** The laptop's start page: Netscrape and its bookmarks. */
  webView() {
    const s = this.g.state;
    const marks = [
      ['social', 'FeedLove'], ['block', 'NextStoop'], ['jobs', 'LinkedOut'], ['invest', 'TradeHarder'],
      ['shop', "Amazin'"], ['tube', 'MeTube'], ['board', 'Kestrel Underground'], ['casino', 'HardLuck Bet'],
      ['bidbay', 'BidBay'], ['xxx', 'DialUpDelights'],
    ];
    return `<div class="papp papp--web"><div class="web__bar"><span>◀ ▶ ⟳</span><span class="web__url">http://www.netscrape.com/home</span></div>
      <div class="app__body">
        <div class="web__logo">Netscrape <em>Navigator 4.7</em></div>
        <div class="web__search"><input type="text" placeholder="Search the World Wide Web (all of it)" disabled /></div>
        <div class="web__marks">${marks.map(([id, name]) => `<button class="web__mark" data-act="go" data-arg="${id}"><b>${T(name)}</b><span>${T(name.toLowerCase().replace(/[^a-z]/g, ''))}.com</span></button>`).join('')}</div>
        <div class="tiny mono-dim">You have ${s.messages.filter((m) => !m.read).length} unread messages on your phone. Your mother would like you to know she has email now.</div>
      </div></div>`;
  },
};

/** NextStoop's POST tab, drawn inside the phone's blockView. */
export function stoopPostBody(phone) {
  const s = phone.g.state;
  const gig = block.gigToday(s);
  const sale = block.saleToday(s);
  const clap = health.clapSymptomatic(s) && !health.healthState(s).clap.posted ? STRANGER_BY_ID[health.clapFrom(s)] : null;
  const mine = (s.stoopPosts || []).slice(0, 6);
  return `
    <div class="fcompose"><input id="stooptext" type="text" maxlength="160" placeholder="tell the block something…" autocomplete="off" spellcheck="false" /><button class="btn btn--primary btn--sm" data-act="stooppost">POST</button></div>
    ${gig ? `<div class="nstoop"><div class="nstoop__cat">Help wanted</div><div class="nstoop__who">${T(gig.who)}</div><div>${T(gig.text)}. $${gig.pay} cash.</div><button class="btn btn--sm btn--primary" data-act="stoopgig">I'LL DO IT · ${gig.minutes} MIN</button></div>` : '<div class="nstoop"><div class="nstoop__cat">Help wanted</div><div>Nobody needs anything carried today. Check tomorrow.</div></div>'}
    ${sale ? `<div class="nstoop"><div class="nstoop__cat">For sale on the stoop</div><div class="nstoop__who">${T(sale.who)}</div><div>${T(sale.name)}, "works fine." ${money(sale.price)}.</div><button class="btn btn--sm" data-act="stoopsale" ${s.money >= sale.price ? '' : 'disabled'}>BUY IT</button></div>` : ''}
    ${clap ? `<div class="nstoop"><div class="nstoop__cat">You could…</div><div>Warn the block about ${T(clap.name)}. It would be petty. It would also be public.</div><button class="btn btn--sm btn--primary" data-act="stoopclap">POST A WARNING</button></div>` : ''}
    ${mine.length ? '<div class="app__h">Your posts</div>' : ''}
    ${mine.map((p) => `<div class="nstoop"><div class="nstoop__who">${T(p.who)} <span>· day ${p.day}</span></div><div>${T(p.text)}</div>${p.replies.map((x) => `<div class="tiny">↳ ${T(x)}</div>`).join('')}</div>`).join('')}`;
}

/* ------------------------------------------------------------------ actions */

export function siteActions(g, s) {
  return {
    invtab(arg) { this.investTab = arg; },
    invqty(arg, num) { this.invQty = num; },
    invbuy(arg) { if (!market.buy(g, arg, this.invQty || 1)) g.toast('Not enough for that many, plus the fee.', 'bad'); },
    invsell(arg) { const r = market.sell(g, arg, this.invQty || 1); if (r) g.toast(`Sold. ${r.gain >= 0 ? `+${money(r.gain)}` : `-${money(-r.gain)}`} on those shares.`, r.gain >= 0 ? 'good' : 'bad'); },
    invprop(arg) { if (market.buyProperty(g, arg)) g.toast(`You own ${market.PROPERTIES[arg].name}. Somebody will want something fixed by Tuesday.`, 'good'); },
    invten(arg, num) { market.tenantAction(g, Number(arg), ['chance', 'evict', 'list', 'accept', 'refuse'][num]); },
    shopbuy(arg) { shop.order(g, arg, 1); },
    tubewatch(arg) {
      g.advance(15);
      bump(s, 'morale', 3);
      bump(s, 'stress', -3);
      this.tubeNote = `You watched "${arg}". Then the one after it. Then you looked up and it was ${15} minutes later.`;
    },
    boardopen(arg, num) { this.boardThread = num; },
    boardback() { this.boardThread = null; },
    boardpost(arg) {
      const box = this.body?.querySelector('#boardtext');
      const text = String(box?.value || '').trim().slice(0, 160);
      if (!text) return;
      s.boardPosts = s.boardPosts || [];
      s.boardPosts.push({ thread: Number(arg), text, answer: pick(['source?', 'this', 'lurk more', 'ok but who are you', 'based', 'mods', 'my uncle said the same thing', 'you\'re not wrong']) });
      if (s.boardPosts.length > 40) s.boardPosts.shift();
      g.advance(5);
      bump(s, 'morale', 1);
    },
    xxxbrowse() {
      this.xxxPage = (this.xxxPage || 0) + 1;
      g.advance(6);
      const day = dayOf(s.clock.m);
      // a little better, once or twice a day; past that it is just the modem screaming
      s.xxxDay = s.xxxDay === day ? s.xxxDay : day;
      s.xxxToday = s.xxxDay === day ? (s.xxxToday || 0) + 1 : 1;
      if (s.xxxToday <= 2) { bump(s, 'morale', 4); bump(s, 'stress', -4); }
      g.toast(s.xxxToday <= 2 ? 'Six minutes of dial-up for one mosaic. Somehow, it helps.' : 'The modem screams. You feel nothing. You should go outside.', 'info');
    },
    stooppost() {
      const box = this.body?.querySelector('#stooptext');
      const text = String(box?.value || '').trim().slice(0, 160);
      if (!text) return;
      block.postToStoop(g, text);
    },
    stoopgig() { block.takeGig(g); },
    stoopsale() { block.buySale(g); },
    stoopclap() {
      const res = health.postAboutHer(g);
      if (res) g.toast(res.backfire ? 'She posts back. The block takes her side. You read every reply.' : 'Posted. The block thanks you. Gloria does not.', res.backfire ? 'bad' : 'good');
    },
  };
}

export function installSites(Phone) {
  for (const [k, fn] of Object.entries(VIEWS)) Phone.prototype[k] = fn;
}
