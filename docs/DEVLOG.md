# MO: FUNCTIONAL — Development Log & Handoff

> **Status:** Milestone 1 complete — playable vertical slice of all four requested phases.
> Version `0.9.0-m1` · Three.js r169 · no backend · no build step.

This file is both a changelog and a handoff document. If you are another model or
developer picking this up, read **Directives**, **Architecture**, then **TODO**.

---

## 1. Changelog — what exists right now

### Art direction pass — PS1 character redesign (owner priority)
- **Owner directive overrides the earlier "no painted face" rule.** Target look is the owner's
  reference sheets in `assets/ref/` (late-90s console NPC: faceted limbs, textured face).
- `src/render/heads.js`: one skull shape (`HEAD`, `headPoint`) shared by geometry and texture.
  Each character has a FRONTAL portrait in a 160x200 frame (Mo = his reference photo baked into
  `mo_face_data.js` by `scripts/bake-mo-face.py`; everyone else painted from `FACE_SPECS`),
  projected through the skull into a 256x256 cylindrical wrap texture.
- `src/world/characters.js`: bodies use faceted 6–8-sided prisms (flat normals); heads are the
  textured skull + ears + optional hair shells. Rig contract and exports unchanged. Skin/hair now
  come from `FACE_SPECS` (the old `CAST.skin/hair/style` keys were never read by `buildBody`).
- `src/render/faces.js`: HUD/phone/thread portraits are rendered from the actual 3D head with a
  studio light, then mood overlays at projected eye positions. Same exports as before.
- `src/render/retro.js`: output is gamma-encoded (colours/textures were being displayed linear,
  crushing everything dark); vertex wobble is position-based so flat-shaded facets never crack.
- `CONFIG.render.dither` 0.8 → 0.55. Portrait CSS sizes match the 4:5 render.
- `scripts/shot.mjs`: repeatable Playwright screenshots (faces, cast, HUD moods, street).

### Foundation
- `index.html` + `styles/main.css` shell with CRT overlay (scanlines, vignette, rolling
  tracking bar), 4:3 toggle, and a pixel-art UI theme in sickly green / nicotine amber /
  Addison gold.
- Bootstrapped Three.js `r169` from `vendor/three.module.js` (no bundler, no CDN, works
  offline; requires a static server because ES modules cannot load over `file://`).
- Modular architecture: `core/`, `systems/`, `render/`, `world/`, `ui/`. Gameplay systems
  never touch the DOM; UI never mutates stats directly (except through systems).

### 90s-era 3D rendering
- Hand-written GLSL material (`src/render/retro.js`) implementing:
  - **Affine texture mapping** (`vUvA = uv * clip.w`, divided again in the fragment shader).
  - **Vertex snapping** to a 120-unit NDC grid (classic 90s console jitter).
  - **Vertex wobble** driven by a shared `uTime` uniform (also used by the menu).
  - **4×4 ordered dithering** (Bayer via the `bayer2` trick) + 5-bit colour quantization.
  - **Per-pixel height fog**, two-light retro shading (warm key, cool bounce, hemisphere
    ambient, camera-facing fill), emissive flag for unlit signage.
- Low internal resolution (`240p` by default) upscaled with `image-rendering: pixelated`.
- All textures are generated procedurally at runtime on `<canvas>` with nearest filtering
  — the repo contains no binary art except the supplied music.

### World
- Three playable areas: **apartment**, **street**, **church**, plus a separate
  **menu corridor** scene.
- Apartment: bed, fridge, kitchen counter, sink, CRT television, laptop desk, drawer/bag,
  door, poster, water stain, flickering bulb; Chairman the cat appears after adoption.
- Street: apartment entrance, Quik-Stop storefront with awning and neon, The Golden
  Fellowship with gold doors and cross, alley with dumpster and Dex, job board, bench,
  bus stop, lamps, hydrant, road markings.
- Church: pews, altar, gold donation box, candle row, stained windows, Addison at the altar.
- Procedural character rigs: Mo (white tee, denim, goatee, reconstructed from the reference
  image as a low-poly face texture), Addison (white double-breasted suit, gold tie, grey
  hair/beard, gold cufflinks and pocket square), plus Rae, Dale, Dex, Kev and Chairman.
- Animation: procedural walk/idle, intoxication sway and stumble, sleep and sit poses,
  NPC idling, and Addison's absurd exaggerated dance.
- Ragdoll reaction: on overdose/health collapse the player rig detaches into nine physics
  boxes with gravity, floor bounce and friction, plus a camera lurch.
- Third-person follow camera that lurches with intoxication and withdrawal; simple AABB
  collision against furniture and buildings; proximity interaction prompts.

### Simulation
- **Clock:** absolute in-game minutes, 1 real second = 2 / 4.5 / 9 in-game minutes at
  1× / 2× / 4×. Time advances only when the phone and modals are closed.
- **Needs:** energy, hunger, hygiene, stress, morale, addiction, tolerance, risk,
  withdrawal — each with hourly rates in `CONFIG.needs` / `CONFIG.substances`.
- **Withdrawal** begins after a tolerance-scaled interval; raises stress, drains morale and
  energy, and eventually causes a forced collapse (lost hours).
- **Overdose:** risk ≥ 100 is an ending. Risk decays when fed/rested/clean and rises with
  withdrawal, neglect (hunger or energy at zero) and repeated dosing. A non-lethal scare at
  risk ≥ 76 triggers a paramedic event with two meaningful choices.
- **Employment:** Quik-Stop #14, Mon–Fri 09:00–17:00, $11.50/hr minus $6 transport, late
  arrival docks pay 18%, three strikes = fired; call-outs cost a strike; quit and rehire.
  Bootlegs/food run through the Pantry app and the physical store.
- **Bills:** rent ($420 / 7 days), power ($64 / 14 days), phone ($35 / 7 days) with cycle
  accounting, arrears, eviction notice and power cut.
- **Odd jobs:** five jobs with distinct energy/hygiene/stress/morale costs, one per day each.
- **BidBay:** list any non-document item at any price; sale probability scales with price
  versus market value; listings resolve after 7–26 in-game hours; unsold items return.
  Grab Bag purchases deliver a random resale item after ~30 minutes.
- **Civic Relief Program:** requires ID + lease, 45-minute appointment, weekly food credit,
  7-day recertification, suspension on lapse, one-time emergency utility grant.
- **The Golden Fellowship:** five-stage recruitment pipeline with Sunday services,
  travel allowance, escalating tithe obligations and a pledge ending. Refusing is possible.
- **Random events:** 17 authored events (some repeatable) with real choices and costs —
  pipe leak, Nia's call, Dale's overtime, bus inspectors, Chairman's adoption, karaoke
  invite, Addison's flyers and knocks, bad batch, dumpster luck, and more.
- **Social:** FeedLove posting costs time, moves followers, can backfire or attract a
  small donation.
- **Endings:** 11 defined, reachable endings — overdose, evicted, terminated, pledge, empty,
  snapped, withered, functional, steady, lucid, quiet — each with an epilogue and run stats.
- **Daily report** at 03:00 with money/stat deltas; autosave every 60 in-game minutes;
  three manual save slots plus autosave.

### Smartphone
One shell, eleven functional apps: Messages, Banking, Employment, BidBay, Calendar,
Pantry, Inventory, Rent & Bills, FeedLove, Fellowship, System (settings/saves/stats).
Every button calls a system function — there are no dead controls. The phone pauses time.

### Main menu
- Audio-reactive: the supplied track's spectrum drives the equaliser, camera shake,
  corridor fog distance and title glitch.
- The menu scene is a receding concrete corridor with Mo standing in it and a distant
  figure of Addison dancing in the fog — directly echoing the Mo reference image.
- Public-access TV framing, rolling ticker, live save metadata, "press start" audio gate.
- Settings (CRT, 4:3, volume, default speed), save loader, help, credits.

### Supplied art
- `assets/assets.js` (base64 data URIs, added to the repo by the owner) is loaded first, and
  `src/render/textures.js → moFaceTexture()` trims the wall behind the head, keeps the art's
  native 64×104 aspect, nearest-filters it and maps it to the front of Mo's skull — so the
  in-game character wears the supplied reference art, not a drawn approximation.
  `MO.ASSETS.moAvatar` is the signed-in avatar in the phone.

### Portrait bank — the cast's faces
- `src/render/faces.js` paints every character face at 128×178 (the head's real 0.72 aspect,
  so nothing is stretched sideways) in one consistent style: light from the upper left, a
  warm skin base with two shadow tones and one highlight, shaped hair masses, and the same
  landmark grid for all six heads.
- Per-character painting covers what geometry cannot: Addison's swept grey hair and full
  beard, Kev's blond crop and square jaw, Rae's black bob and fringe, Dale's receding hair
  and age lines, Dex's dreadlocks and heavy beard, Nia's braided hair.
- Each portrait is blitted once with its own exposure (`brightness`), so darker complexions
  stay readable in the game's unlit rooms instead of collapsing to a silhouette, and each
  head's side planes use that portrait's own skin tone (`faceSkin`) so the painted face and
  the cheek geometry meet without a visible seam.
- The face material keeps a small emissive floor: the portraits are baked art, not surfaces
  that should be re-lit from scratch by a streetlamp.

### Character rig v3 — faces on heads, NPC bodies, voices
- **Faces are geometry now, not decals.** `taperMulti()` in `src/render/retro.js` gives one
  tapered box a material per face, so the portrait texture *is* the front face of the skull
  (skin on the sides, hair on crown and nape). The pasted-on rectangle and its visible border
  are gone; heads still take the world light, with a touch of emissive so they read at night.
- **`npcFaceTexture(kind)`** paints a 64×104 portrait per character (hair, brows, sunken eyes,
  nose shadow, mouth, optional beard) so every NPC is built exactly like Mo.
- **Body pass:** torso is three tapered segments (chest → ribs → waist) instead of one slab,
  tee sleeves cover the deltoid and half the bicep with a hem, hands get a thumb block.
- **NPCs walk.** `patrolNPC()` in `game3d.js` gives each one a home patch, a wander target and
  the same joint gait Mo uses (`animateNPC(..., { walking })`), instead of standing and swaying.
- **Charlie Brown voice.** `audio.mumble()` synthesises wordless syllables — sawtooth through a
  bandpass with a drifting pitch — and `talk()` in `areas.js` calls it per NPC with a per-speaker
  pitch (`NPC_VOICE`). The words stay in the text; the voice stays unintelligible.
- **Naming:** every platform-name reference was removed in favour of "90s-era";
  `src/render/ps1.js` is now `src/render/retro.js` and the shader API is
  `retroMaterial` / `retroUniforms`.
- **Film grain:** an SVG-turbulence layer on the CRT stack, stepped at 20fps, for the wet
  tape look.

### Character rig v2 — proportions and light
The first rig was an honest mistake: limbs were single boxes hung from the hip and shoulder,
nothing was jointed below that, and the head was small, so Mo read as a white slab with a
face taped on. Rebuilt in `src/world/characters.js`:
- **~7.5-head proportions** measured from the figure, not eyeballed: 0.245 m head, 1.78 m
  body, hips at 0.915 m, shoulders 2.2 heads wide, fingertips at mid-thigh.
- **Every part is a tapered box on a joint pivot** — new `taperGeo()` in `src/render/retro.js`
  (8 corners, flat per-face normals, per-face UVs) — with hip → knee → ankle and
  shoulder → elbow → wrist chains. Thighs, shins, arms and torso all taper.
- **Animation drives the joints**: knees flex only during the swing phase and bend one way,
  elbows carry the arm swing, ankles roll; sitting folds thigh and knee together properly.
- **Face mapping**: the supplied 64×104 art is mapped at its native aspect instead of being
  squashed into a square, and pushed clear of the head vertices so vertex wobble cannot
  punch through it.
- **Shading rebuilt** in the same shader: warm key + cool bounce + sky/ground hemisphere +
  a camera-facing fill (`uHeadTint`), replacing plain `0.55 + 0.45·N·L`, which had made
  every front-facing surface read as mud. `retroUniforms` exposes the tints for per-area
  grading; `setAreaLighting()` is available for that pass.
- **Bug found while wiring it up**: `taperGeo()` wound its quads the wrong way, so every new
  face was back-face culled and unlit (the rig looked like floating slabs). Fixed the
  winding and the normal cross-product direction together.

### Deployment — GitHub Pages + arcade hub
- The game is published straight from this repo: **https://xiondigital.net/mofunctional/**
  (Pages, `main` / `/`). `xiondigital.net` is the custom domain on the
  `xiondigital.github.io` user site, so project sites inherit it — a `CNAME` file must NOT
  be added here, it would fight the user site.
- `.nojekyll` at the repo root keeps Jekyll from processing the vendored module tree.
- Pages for this repo needed a public repo (the free plan has no private Pages), so the
  repo was made public at publish time. No secrets, env files or keys were ever tracked.
- Listed on the arcade wall (`XiONDiGiTaL/arcade`) as the sixth title, tile
  `assets/img/mofunctional.jpg` (1200×675, captured from the live build), filter tag
  `life-sim`, link `https://xiondigital.net/mofunctional/`.
- Relative paths only, so the same build works at `/mofunctional/`, at the arcade, or from
  any local static server.

### Audio
- `assets/audio/menu_theme.mp3` (copy of the repo's `Music/Mo Functional_ Main Menu.mp3`)
  routed through WebAudio so an analyser can read it.
- Procedural SFX: UI blips, confirmations, denials, cash, footsteps, doors, dose sweep,
  bad-news sting, alarms — all synthesized, no audio files added.

---

## 2. Directives (read before changing anything)

1. **Balance lives in `src/core/config.js`.** Never hardcode a price, wage, rate, threshold
   or duration in gameplay code. If a number is needed twice, it belongs in CONFIG.
2. **No dead controls.** Every button, prompt, choice and app action must call a system.
   If a feature is not ready, remove the control rather than wiring an empty handler.
3. **Addiction is mechanical, never instructional.** All substances are fictional. Effects
   are expressed as risk/addiction/tolerance/withdrawal numbers. Never add dosing advice,
   real drug names, procurement detail or "how to" text. Keep the tone dark comedy.
4. **No violence.** There is no combat, no weapons, no drug-deal violence. Conflict is
   financial, social and temporal.
5. **Addison is original fiction.** He is inspired only by a wardrobe reference (white
   suit, gold tie). Do not map him to any real person, church or organisation.
6. **Systems stay headless.** `src/systems/*` must not read or write the DOM. UI reads state
   and calls systems. This keeps simulation testable.
7. **Time is the only currency that matters.** Any new interaction must decide its minutes
   cost. Instant free actions erode the entire design.
8. **Keep the 90s-era look.** No PBR materials, no antialiasing, no smooth high-poly models, no
   HDRI. Characters follow `assets/ref/`: faceted limbs, one wrap face texture per head
   (render/heads.js); add new cast members as a `FACE_SPECS` entry, not new geometry. New geometry should use `retroMaterial`/`box`/`plane` from `src/render/retro.js`.
9. **Test in a real browser** (see §6). Console errors are failures.

---

## 3. Architecture map

```
index.html                 shell; mounts #stage #crt #ui
styles/main.css            UI, CRT, phone, menu, endings
vendor/three.module.js     Three.js r169 (vendored, offline)
assets/audio/menu_theme.mp3 supplied menu music (copy)
Music/                     original supplied file (untouched)

src/main.js                Game class: loop, input, save/load, endings, orchestration
src/core/config.js         ALL balance + content catalog (items, jobs, substances)
src/core/state.js          state shape, item/clock/money/log helpers
src/core/save.js           3 slots + autosave (localStorage, key mofunctional.save.v2)
src/core/audio.js          music via WebAudio + analyser, procedural SFX
src/core/util.js           clamp/money/time/format helpers

src/systems/needs.js       simulate() — the only place time moves; withdrawal, risk, sleep, eat, dose
src/systems/economy.js     bills, groceries, BidBay, CRP, utility grant, deliveries
src/systems/jobs.js        shifts, strikes, odd jobs, quitting/rehire
src/systems/events.js      17 random/conditional events with choices
src/systems/fellowship.js  Addison's five-stage recruitment and tithe pipeline
src/systems/endings.js     11 endings + checkEndings()
src/systems/dialogue.js    all prose: sermons, NPC barks, intro, help

src/render/retro.js          shader material, renderer, box/plane helpers, resize
src/render/textures.js     procedural canvas textures (concrete, lino, faces, neon, ...)

src/world/characters.js    Mo / Addison / NPC / cat rigs + procedural animation
src/world/areas.js         apartment, street, church, menu corridor; every interactable action
src/world/game3d.js        World: scenes, movement, camera, prompts, ragdoll, menu camera

src/ui/hud.js              clock, needs, objective, toasts, speed/pause/phone controls
src/ui/phone.js            phone shell + 11 apps + action table
src/ui/modal.js            choice modal
src/ui/menu.js             main menu, intro, settings, saves, credits, ending screens

docs/DEVLOG.md             this file
docs/GAME_DESIGN.md        design bible / economy maths
```

### The one invariant that matters
`simulate(g, minutes, ctx)` is the only function that advances the clock. It applies needs,
handles day rollover, rolls events, resolves BidBay, checks endings and autosaves. Every
action funnels through `g.advance(minutes, ctx)` → `simulate`. If you add a time cost
anywhere else, the day-boundary logic will miss it.

---

## 4. Economy sanity check (as tuned)

| Resource | Per day | Per week |
|---|---|---|
| Wages (5 shifts × 8h × $11.50 − $6) | $86 net | $430 |
| Rent | — | −$420 |
| Power | — | −$32 avg |
| Phone | — | −$35 |
| Food (~2 meals) | −$6 to −$11 | −$42 to −$77 |

So the job alone leaves roughly **−$99 to −$134 per week**. Odd jobs ($22–$74), BidBay
sales ($45–$150) and the Fellowship allowance ($55/service) are not optional flavour —
they are the margin. This is deliberate: the player should feel the arithmetic tightening
while the phone keeps offering easier, worse answers. If you re-tune wages upward, also
re-tune rent, or the game becomes a walk.

---

## 5. Verification log

Verified locally (headless Chromium via Playwright, software WebGL):
- Page loads, start gate dismisses, menu → new game → intro → gameplay.
- HUD clock/needs update; phone opens; all eleven apps render; **0 console errors**.
- Paid rent ($420) through the Banking app: `paidCycle` advanced and the balance dropped.
- Listed the CRT TV on BidBay through the UI: listing created and held by the marketplace.
- Clocked in through the Employment app on a Tuesday at 09:08: shift worked, $84.08 paid,
  time advanced to 17:00, strikes cleared.
- Saved to slot 2 and read the slot metadata back.
- Movement, proximity prompts, area transitions (apartment → street → church) all work.
- Ending screen renders with the correct epilogue and run stats.
- Screenshots in `assets/img/` were captured from this build.

Fixed during verification (keep these in mind — they were real bugs):
- The game booted twice (immediate boot + DOMContentLoaded), stacking two start gates.
  `src/main.js` now guards with a single `boot()` and `window.MOF` check.
- `AudioContext.resume()` can hang without an output device, which blocked the start gate.
  Audio is now non-fatal, bounded by a timeout, and dismissed before sound starts.
- The follow camera sat above the apartment ceiling and inside the street facades. It is
  now distance-limited per area, clamped to the area bounds, and pulled toward the player
  when it would land inside a solid.
- `backdrop-filter` / `mix-blend-mode` made every overlay render black on software
  compositing; removed from `.screen` and the scanline layer.
- Phone app panes used a `.app` wrapper that inherited the fullscreen root `.app` rule,
  so every app escaped the phone frame. Renamed the pane wrapper to `.papp`.
- The bill config used the key `phoneBill` while every lookup asked for `phone`, which
  crashed day rollover and the Banking app. Renamed to `phone` and added a fail-soft
  guard in `billInfo()` so an unknown key logs instead of killing the UI.

Not fully verified (needs human play):
- Long-run balance across 30 in-game days (numbers are analytic, not playtested).
- Comfort of movement/camera in a real browser at 60fps on low-end hardware.
- Mobile/touch layout (CSS has a narrow breakpoint, but there are no touch controls yet).

---

## 6. TODO / handoff list

### High priority
- [ ] **Playtest a full 30-day run** and log where money/time breaks down. Adjust
      `CONFIG.economy`, `CONFIG.job.wage`, odd-job pay. Record results here.
- [ ] **Touch controls** for tablets/phones (virtual stick + interact + phone button).
- [ ] **Camera collision**: the follow camera clips through walls in the apartment corner.
      Add a raycast clamp against `area.solids`.
- [ ] **Bed/sleep while phone open** — currently sleeping from the Calendar app works
      anywhere; restrict it to the apartment for consistency with the bed interaction.
- [ ] **Save migration**: `state.v` exists but no migration path. Add one before v3.

### Medium priority
- [ ] More events: landlord inspection, health clinic visit, a second job offer, a
      roommate subplot, Chairman's vet bill.
- [ ] Fellowship stage 3 should visibly change NPC dialogue in the street (rumours).
- [ ] Add a "recovery" path: a clinic appointment chain that reduces addiction but costs
      days and money (there is a `flags.wantsHelp` hook already set by the paramedic event).
- [ ] Addison's dance should sync to the music when the menu is active (analyser already
      exposed via `g.audio.level()`).
- [ ] Add optional 16:9 → 4:3 letterbox framing with animated overscan.
- [ ] Skybox / distant city backdrop for the street; currently the fog eats the horizon.
- [ ] Footstep surface variation (lino vs asphalt vs carpet).

### Polish / content
- [ ] Audio: diegetic radio in the apartment, phone notification chimes per app,
      Addison's service ambience (organ + coughing).
- [ ] Environmental storytelling: more posters, notes, fridge magnets, a wall calendar
      that reflects the real in-game date.
- [ ] Ending-specific menu art (the corridor changes after an ending).
- [ ] Accessibility: font-size toggle, reduced screen-shake, colourblind-safe stat bars.
- [ ] Localisation hooks (all prose is in `dialogue.js` and `areas.js` — extract to JSON).

### Known rough edges
- `simulate()` steps in 10-minute chunks; very long advances (9h sleep) run ~54 iterations
  per call, which is fine but could be batched later.
- Events opened mid-advance (e.g. during a work shift) will render their modal while the
  remaining advance continues behind it; the main loop pauses, but the current
  `simulate()` call finishes. Harmless now, worth a review if you add lethal events.
- The phone re-renders on every action, which resets scroll position in long lists.
- `world.blocked()` is a simple AABB check; diagonal movement can slide into furniture
  corners. Acceptable for the apartment's layout.

---

## 7. If you are an AI model continuing this work

1. Run a static server from the repo root and open it in a browser **before** editing:
   `python3 -m http.server 8080` → `http://localhost:8080`.
2. Read `src/core/config.js` and `src/main.js` first. They define the contract.
3. Make the smallest change that satisfies the request; keep systems headless.
4. Verify: no console errors, a shift can be worked, rent can be paid, the phone opens.
5. Update this file (changelog + TODO) and `README.md` status section when you finish.
6. Do not commit secrets, do not add a backend, do not add real-world drug information.

**Last known good state:** menu → new game → intro → apartment → phone → shift at
Quik-Stop → rent payment → BidBay sale → ending screen. All of that is wired.
