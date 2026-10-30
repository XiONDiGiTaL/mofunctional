# xiondigital.net/arcade

The game hub for **xiondigital.net**, a static single-page wall that opens each game on
its own site.

Live: **https://xiondigital.net/arcade/**

## What's inside

```
index.html           the whole page (games are plain markup, works without JS)
assets/css/style.css layout, cards, responsive rules
assets/js/arcade.js  synthesised hover/click sounds, genre filters, spotlight, clock
assets/img/*.jpg     live in-game captures, one per title (1200 × 675, 16:9)
```

No build step, no dependencies, no framework. Assets use relative paths, so the site works
at `/arcade/`, on a custom domain root, or straight from disk.

## The wall

| Game | Credits | Genre | Link |
| --- | --- | --- | --- |
| Meldra | XiØN | falling-block puzzle, solo & co-op | `xiondigital.net/meldra/` |
| Voxel Rage: Janitscharen | Player529 | beat 'em up, co-op | `xiondigital.net/voxelrage/` |
| Kanka Kombat: Nutella Nights | XiØN | beat 'em up, co-op | `xiondigital.net/kankakombat/` |
| Leap Buddies | XiØN | voxel platformer, two-player co-op | `xiondigital.net/leapbuddies/` |
| Grease & Gold: World Tour | XiØN & Player529 | beat 'em up, single player | `xiondigital.net/grease-and-gold-world-tour/` |
| MO: Functional | XiØN | PS1-era life sim, single player | `xiondigital.net/mofunctional/` |

Credits are printed under each game's description on the wall.

## Adding a game

1. Drop a 16:9 screenshot into `assets/img/` (1200 × 675 JPEG, matching the rest).
2. Copy any `<a class="game">` block in `index.html` and edit:
   - `href`: the game's own URL
   - `data-tags`: any of `beat-em-up`, `puzzle`, `platformer`, `co-op`, `life-sim` (space separated)
   - the `<img src>`, `alt`, tag chip, title, subtitle, meta line and
     `<span class="game__credit">`
3. Update the title count in the hero meta line (`05 titles`) if the number changes.

Filters read `data-tags`, so no JavaScript changes are needed. A new genre also needs a
button in the `.filters` group with the same `data-filter` value.

## Local preview

```bash
python -m http.server 4174
# then open http://localhost:4174/
```

## Deploying to GitHub Pages

1. Push this repository as **`arcade`** (lowercase) under the `XiONDiGiTaL` account.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.
3. The project site is served at `https://xiondigital.net/arcade/`. Project paths are
   case-sensitive, so the repo name has to stay lowercase for that URL to resolve.

Notes:

- Do **not** add a `CNAME` file here. The `xiondigital.net` domain belongs to the
  `xiondigital.github.io` user site; project sites inherit it automatically, and a CNAME in
  a project repo would conflict.
- `index.html` links its CSS/JS with a `?v=` query, so bump it when either file changes to
  avoid stale caches on GitHub Pages.
- The repo is `XiONDiGiTaL/arcade`; renaming it changes the published URL.

## Design notes

- Near-black canvas (`#050607`) with one cool blue accent (`#3f80ff`) and a soft radial
  glow; no gradient text. Sora for UI, JetBrains Mono for labels and credits.
- The masthead is deliberately compact: a small `xiondigital.net` set against a blue
  `/arcade`, one line of copy, actions on the right, and a thin mono meta strip.
- Cards lift, brighten and pick up a blue edge glow on hover, the screenshot zooms
  slightly, and a pointer-tracked spotlight follows the cursor.
- Every tile is real gameplay captured from the live build, never a title screen, so the
  wall reads as a set of running games.
- No outbound developer links: the page only points at the games and xiondigital.net.
- Interface sounds are generated with the Web Audio API (no audio files); the SFX toggle
  remembers its state in `localStorage`.
- `prefers-reduced-motion` disables the background drift, reveal animations and transitions.

## Notes on MO: Functional

Its tile image is referenced from the game's own Pages site
(`https://xiondigital.net/mofunctional/assets/img/arcade_tile.jpg`, 1200 × 675) rather than
copied into `assets/img/`, so the two stay in step. If that site is ever unpublished, copy
the JPEG into `assets/img/mofunctional.jpg` and point the `<img src>` at it.
