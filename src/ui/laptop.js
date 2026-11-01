/**
 * Mo's laptop. It is the phone's whole engine (every view, every action) in a different body:
 * a lid, a screen, a Netscrape title bar, a keyboard deck. It opens from the table in Unit 3B
 * and starts on the browser's home page, whose bookmarks are the sites: FeedLove, NextStoop,
 * LinkedOut, TradeHarder, Amazin', MeTube, Kestrel Underground, HardLuck Bet, BidBay and the one
 * nobody bookmarks on purpose.
 */
import { el } from '../core/util.js';
import { Phone } from './phone.js';

export class Laptop extends Phone {
  open(appId = null) {
    if (this.wrap) return;
    this.app = appId || 'home';
    this.wrap = el(`<div class="laptop-wrap"><div class="laptop">
      <div class="laptop__lid">
        <div class="laptop__screen">
          <i class="phone__screen" style="display:none !important"></i>
          <div class="laptop__bar">
            <b>Netscrape Navigator</b>
            <span class="spacer" style="flex:1"></span>
            <span data-live="clock">--:--</span>
            <span data-live="money">$0</span>
            <button data-nav="home" title="Home">⌂</button>
            <button data-nav="close" title="Close the laptop">✕</button>
          </div>
          <div class="phone__body"></div>
        </div>
      </div>
      <div class="laptop__base"></div>
    </div></div>`);
    this.body = this.wrap.querySelector('.phone__body');
    this.wrap.addEventListener('click', (e) => {
      // clicking the dimmed room around the laptop closes it, like setting it down
      if (e.target === this.wrap) { this.close(); return; }
      this.onClick(e);
    });
    this.wrap.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      if (e.key === 'Escape') { e.target.blur(); return; }
      e.stopPropagation();
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

  /** The laptop's home is the browser's start page, not the phone's app grid. */
  homeView() { return this.webView(); }
}
