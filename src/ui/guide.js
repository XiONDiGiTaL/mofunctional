/**
 * The guide: a few illustrated pages that explain the parts of the week that are not obvious
 * from walking around. It opens once at the start of a new run, after the morning notice, and
 * it is the How To Play screen from the title and pause menus, with the controls on the last page.
 */
import { HELP_TEXT } from '../systems/dialogue.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const GUIDE = [
  {
    title: 'Going to Work',
    img: 'assets/img/guide/guide_work.jpg',
    body: 'Your shift at Quik-Stop #14 is 09:00 to 17:00, Monday to Friday. Walk out of 1120, turn right, and go into the Quik-Stop. In the back left corner is a door marked EMPLOYEES ONLY with the time clock beside it. Stand there and press F to clock in.\n\nLate is a strike. Three strikes and Dale lets you go.',
  },
  {
    title: 'The LIVE Board',
    img: 'assets/img/guide/guide_board.jpg',
    body: 'The A-frame sign marked LIVE on the sidewalk is the job board: today\'s odd jobs, cash the same day, gone tomorrow. Walk up to it and press F to read it.\n\nA shop with a HIRING sign in the window is hiring. Downtown, Ready Hands takes day labour in the morning.',
  },
  {
    title: 'Work from Your Phone',
    img: 'assets/img/guide/guide_jobs.jpg',
    body: 'LinkedOut, on the phone (TAB) or the laptop at home, shows your job, your strikes, and every odd job on the board today. Pick one and you are sent there.\n\nIf you lose the Quik-Stop job, this is where you find the next one.',
  },
  {
    title: 'Your Pockets',
    img: 'assets/img/guide/guide_pockets.jpg',
    body: 'Pocket Lint, on the phone, is everything Mo is carrying. Eat, drink and smoke from here, sort by kind or by value, and see what your things would fetch on BidBay or at Ashby Pawn & Gold.',
  },
  {
    title: 'Food and Hunger',
    img: 'assets/img/guide/guide_fridge.jpg',
    body: 'The FOOD bar drops all day. Let it reach zero and your energy goes with it. Groceries keep in the fridge at home; eat from the fridge or straight from your pockets.\n\nMiguel, Habib and the Quik-Stop sell food. The Civic Relief Program gives food credit if you keep recertifying, on the Pantry app or at the office Downtown.',
  },
  {
    title: 'Party Favors',
    img: 'assets/img/guide/guide_favors.jpg',
    body: 'Bliss, Static, Mud and Drip are invented substances that exist only in this game. Use them from Pocket Lint or the drawer at home. Each one lifts the mood and raises RISK and DEP. Risk at 100 is an overdose.\n\nThe Kestrel Clinic treats dependence. The toilet tank at home keeps a stash out of your pockets.',
  },
  {
    title: 'Controls',
    img: null,
    body: HELP_TEXT,
  },
];

/**
 * Open the guide over whatever is on screen. `pages` picks which (indexes into GUIDE); the last
 * page's button closes it. Returns the overlay element.
 */
export function showGuide(game, { pages = GUIDE.map((_, i) => i), onClose = null, kicker = 'HOW TO PLAY' } = {}) {
  let i = 0;
  const root = document.getElementById('ui') || document.body;
  const ov = document.createElement('div');
  ov.className = 'screen guide';
  const draw = () => {
    const p = GUIDE[pages[i]];
    const last = i === pages.length - 1;
    ov.innerHTML = `<div class="panel guide__panel">
      <div class="modal__kicker">${esc(kicker)} · ${i + 1} / ${pages.length}</div>
      <h2 class="modal__title">${esc(p.title)}</h2>
      ${p.img ? `<img class="guide__img" src="${esc(p.img)}" alt="${esc(p.title)}">` : ''}
      <div class="guide__body${p.img ? '' : ' guide__body--mono'}">${esc(p.body).replace(/\n/g, '<br>')}</div>
      <div class="guide__nav">
        <button class="btn btn--sm" data-g="skip">${last ? '' : 'SKIP'}</button>
        <div class="guide__dots">${pages.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
        <div class="row" style="gap:8px">
          ${i > 0 ? '<button class="btn btn--sm" data-g="prev">BACK</button>' : ''}
          <button class="btn btn--sm btn--primary" data-g="next">${last ? 'GOT IT' : 'NEXT'}</button>
        </div>
      </div>
    </div>`;
    if (last) ov.querySelector('[data-g="skip"]').style.visibility = 'hidden';
  };
  const close = () => {
    ov.remove();
    window.removeEventListener('keydown', key, true);
    if (game) game.guideOpen = false;
    onClose?.();
  };
  const go = (d) => { i = Math.max(0, Math.min(pages.length - 1, i + d)); draw(); };
  const key = (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); e.stopPropagation(); if (i === pages.length - 1) close(); else go(1); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };
  ov.addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (!b) return;
    if (b.dataset.g === 'next') { if (i === pages.length - 1) close(); else go(1); }
    else if (b.dataset.g === 'prev') go(-1);
    else if (b.dataset.g === 'skip') close();
  });
  window.addEventListener('keydown', key, true);
  draw();
  root.appendChild(ov);
  if (game) game.guideOpen = true;
  return ov;
}
