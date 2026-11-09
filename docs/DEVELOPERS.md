# MO: FUNCTIONAL, for developers

The player's guide is the [README](../README.md). This page is the workshop: how the game is
built, how to test it, and the switches that are not meant for players.

## Running it locally

The game is a static site with no build step. ES modules do not load over `file://`, so serve
the folder:

```bash
npm start
```

That runs `python3 -m http.server 8080` (`npx serve -l 8080 .` works too). Open
http://localhost:8080 and click PRESS START; audio starts on that first click, per browser
autoplay rules. Saves live in `localStorage`: three slots plus an autosave.

## Systems notes

### Rent

**Rent can be paid early.** If nothing is outstanding, the Banking app's rent card and
Landlordly both offer **PAY EARLY**: it settles the *next* cycle in advance, moves the due date
on by a week, and the due date finds the cycle already settled, so Mo is never charged twice.
One cycle ahead at most, and a short lock swallows a double click. Every payment is recorded in
`bills.rent.history` (day, amount, which cycle, the partner share that applied) and shown in the
app.

### Rolo's orders

**Integrity.** Only one order can be open at a time. Ordering checks the balance up front and
the handoff checks it again; being short at the meet cancels the order without charging. Money
moves exactly once, inside the handoff, after the order is marked completed, so a second click
or a second call finds a finished order and does nothing. The thread ignores taps while Rolo is
"typing". Orders are saved with the run: reload mid-order and he is still on his way (or
standing there); leave him waiting three game hours and the order expires, uncharged.

## Seats, heights and rooms

- **Seats.** Add `seats: [{ x, z, rot, y, label, sub, action }]` to an area's return to make a
  bench or chair sittable; `x, z` is where Mo sits, `rot` the way he faces, `y` the seat height
  (0.46 by default). An existing interactable can take `seat: {...}` instead, and Mo sits before
  its action runs. See `World.addSeats`, `sit` and `standUp` in `world/game3d.js`.
- **NPC height.** `npcs: [{ ..., y }]` lifts a rig onto a bench, a bed or a machine.
- **Small rooms** (no traffic, under 140 m², no `camBounds`) get the cutaway camera
  automatically. Give a room `camBounds` to opt out. A solid with `seeThrough: true` stops Mo but
  not the camera (chain-link).
- **Area-held music.** `g.soundtrack.cue(trackId, seconds, areaId)` holds a track in one place.

## Languages

English is the source. Nothing in the code is written against translation keys: lines are
authored in English as usual, and `src/i18n/i18n.js` translates the interface as it reaches the
screen. A `MutationObserver` on `document.body` swaps each text node (and the `placeholder`,
`title` and `aria-label` attributes) for its translation and remembers the English, so switching
back is instant. The 3D world is a canvas, so signs and posters never change.

- `src/i18n/catalog.js` is every English line the game can show, generated from the source.
  Template literals become patterns: `` `Rent ${amt} due ${when}` `` is filed as
  `Rent {0} due {1}`, matched with a regex, and the captured values are translated too.
- `src/i18n/es.js` and `de.js` map a short FNV-1a hash of each English line to its translation.
  Missing lines simply stay in English.
- An element with `data-i18n-skip` (the language buttons, for instance) is left alone.

Workflow after adding or changing text:

```bash
npm run i18n                              # rebuild the catalog, print coverage
node scripts/i18n-catalog.mjs --todo es   # write i18n-todo-es.tsv: key<TAB>English, untranslated
node scripts/i18n-merge.mjs es done.tsv   # merge key<TAB>translation lines into src/i18n/es.js
npm run stamp
```

The merge refuses a translation whose `{0}` holes differ from the English. Single lowercase
words in markup look like code to the scanner, so they go in the `EXTRA` list in
`scripts/i18n-catalog.mjs`. Keep app, place and substance names as they are, and keep texts in
lowercase slang. Translate the descriptor around a name rather than the name itself. If you
build a sentence out of pieces in JavaScript, run each piece through `tr()` first. The Today
panel's job names are an example of this.

## Soundtrack

Seven tracks in `/Music`, each written for a place, played through one crossfading director
(`src/systems/soundtrack.js`). One track is heard at a time. Moving between places crossfades
(about 1.8 s); a place that shares the current track never restarts it; a track left mid-song
resumes where it was when Mo comes back. The menu always starts from the top.

| File | Plays |
|---|---|
| `Mo Functional_ Main Menu.mp3` | title screen and menus |
| `Mo Functional_ City.mp3` | Kestrel Street by day |
| `Mo Functional_ Quik-Stop.mp3` | inside the store, within a few metres of its front, and for a minute after a shift |
| `Mo Functional_ Bodega.mp3` | inside the bodega |
| `Mo Functional_ Habib.mp3` | inside Habib's Corner |
| `Mo Functional_ Church.mp3` | inside the Golden Fellowship |
| `Mo Functional_ Lost Time.mp3` | Unit 3B; the clinic; the street and park from 22:00 to 05:00; severe withdrawal; the endings |

Kestrel Park plays *City* by day.

The files are 64 kbps, 48 kHz MP3s and are played exactly as delivered. Their low resolution,
grain and crunch are the sound of the game, and nothing in the audio chain filters or
normalises them. Sound effects (UI blips, doors, cash, munching, the mumbled NPC voices) are
synthesised live in WebAudio.

## The debug menu

Press **`~`**, type `Moses`, press Enter. A wrong password closes the prompt with no message, no
error and no hint that anything exists. The panel is a dark green console in the game's own
style, and the clock stops while it is open:

- **Condition:** fill everything, move any single need by ±10, clear intoxication, tolerance and
  withdrawal, or reset dependence and risk.
- **Money:** $1,000 a click, as many times as you like, straight into the balance.
- **Time:** set the hour, skip hours, advance a whole day, jump to a later day (forward only:
  the bills, the life history and every cooldown are keyed to the day), pause or resume the clock.
- **World:** teleport to any area, fire any event by id, clear every event cooldown, spawn or
  despawn a chosen NPC near Mo, and reset NPC schedules (everyone snaps back to where they should
  be at this minute).
- **Relationships:** affection ±10 for each of the three, girlfriend and live-in flags, a
  pending present, or a full relationship reset.
- **Testing:** a collapse, a clinic recovery, an early rent payment, rent marked paid, a date,
  Cheeks, the Afterglow, the dance, using a substance, a free item, the phone, the daily report.

Every button calls the real system, `rent.payRent`, `clinic.treat`, `romance.startDate`,
`world.playDance`, `useSubstance`, so what it changes is what a player would get, and it all
lands in the normal save state.

## Rendering

Late-90s console rendering in a custom shader: a low internal resolution scaled up, affine
texture mapping, vertex snapping, ordered dithering and fog, with procedural textures painted at
low resolution and nearest-filtered. Signs and shop names are painted the same way. An optional
CRT layer adds scanlines, vignette, tracking and grain.

## Project layout

```
index.html              page shell, CRT overlay, UI root
styles/main.css         base UI: HUD, phone chassis, threads, menus, modals
styles/ui2.css          skins, message feed, MoPhone apps, Rolo's Line, menu boards,
                        fridge, map and minimap, daily report
Music/                  the soundtrack (see above)
src/main.js             orchestrator: loop, state flow, saves, handoff, map toggle
src/core/               config (all balance values), state, input, audio (crossfades
                        + synthesised sfx), save, util
src/systems/            needs, economy, jobs, events, street, fellowship, dialogue,
                        endings, dealer (Rolo's orders), soundtrack (music director),
                        rent (early pay + history), romance (partners, dates, gifts,
                        household), clinic (treatment + recovery), sms (sender
                        identity and replies), scheduler (weights, cooldowns), calls
                        (contacts, the keypad and its easter eggs), delivery (Miguel's
                        and Habib's courier), feedtalk (FeedLove comments, strangers,
                        arguments), wardrobe (outfits, Jay's mail orders), modes (the six opening
                        problems), shiftplay (the playable Quik-Stop shift), home (repairs,
                        upgrades, the leak), happenings (blackout, heat wave, trains, block party,
                        inspection), owes (Square Up), music (write, record, open mic), arcs
                        (multi-day stories), tenants (organizing the third floor), recovery
                        (support contact, routines, invitations, the way back), papi (the block's
                        encyclopedia: people, places, what is going on), supply (ROX: the
                        three connections on consignment, daily texts, stiffing and
                        collecting, and the fiends who buy it after dark), okafor (HelloNurse69,
                        the clinic deal, the supply room), rae (the landlord on the ground:
                        rent cuts, repairs, fear that fades), ashby (Ashby West: the post
                        office, the court and tickets, the Tuesday group, library, diner,
                        barber, handball, check cashing), early (the first week's
                        texts pointing at systems the player has not found yet)
src/world/              game3d (renderer, camera, movement), areas (every location),
                        plan (the street as data, shared with the map), characters,
                        schedules, shops, title (the title performance), eating,
                        handoff (Rolo on the street + Mo's smile), animations
                        (substance use, collapse, dancing), patrol (the 911 cop), courier
                        (the delivery at 1120's door)
                        hall (1120: lobby and three floors, the elevator), roof (both
                        walkable roofs)
                        assailant (somebody running at Mo: a driver, a Guardian Angle)
                        row (Myrtle Row: Sal's, the carts, the grill, the döner), crowd (what
                        walkers carry and do, sidewalk chats, barks, errands into shops),
                        incidents (purse snatch, police stop and arrest, night graffiti, the buff
                        crew), walls (graffiti art, spots per area, shutters, utility boxes,
                        overnight changes), vistas (street mouths: the next street past
                        the edge, with a gateway banner)
                        duel (a fist fight with Mo's own punches), herplace (the girlfriends'
                        homes, keys, Stephanie's couch, Melanie's rack, Diana's care), flat
                        (break-ins: the shared one-bedroom, residents, searching, 4D),
                        brownstone (the Park Slope house, its yard, guests, catalogue),
                        ashbywest (Ashby Ave West in kit buildings, and its six rooms)
src/render/             retro renderer, textures, signs, heads (skull, wrap faces,
                        expressions), faces (HUD portraits), models (Polyfork kit GLBs:
                        a small GLB reader that bakes each file into one vertex-coloured
                        geometry, cached; model('hydrant', {x, z, height}) places one)
assets/models/          the kit GLB files, named by their Polyfork id (CC BY 4.0)
src/ui/                 hud, feed, phone, apps (parody catalog + icons), icons (item
                        art), shopmenu, fridge, map, threads, modal, menu, themes,
                        debug (the hidden menu), arcade (the three cabinets at Dee's),
                        pinups (the mosaic pictures for LonelyFans and DialUpDelights)
                        wallpapers (the home screen's pictures, Snapz photos, memories), marquee (the happenings banner)
                        tv (looping canvas clips: Unit 3B's channels, the TV overlay, MeTube's player)
                        studio (offscreen renders of the game's models for phone pictures)
scripts/check-syntax.mjs  parses every module in src/ (npm run check)
scripts/test-systems.mjs  headless system checks (npm test)
scripts/stamp.mjs         cache-busting import map in index.html (npm run stamp)
docs/                   design notes, devlog, art handoff
```

Balance lives in `src/core/config.js`. Gameplay code reads from `CONFIG` rather than
hard-coding numbers.

```bash
npm run stamp    # after changing any JS/CSS: re-stamps index.html so players get the new files
npm run check    # syntax-checks every module and fails if index.html is not stamped
npm test         # headless checks for the systems (no dependencies)
```

`npm test` runs `scripts/test-systems.mjs` in plain Node against a small game stub: rent
arithmetic, early payment and the double-payment guards, partner rent shares, date costs and
outcomes, the Afterglow clock, gifts, household restocking, event cooldowns and the daily cap,
SMS identities and replies, and clinic treatment and billing. It then runs
`scripts/test-district.mjs` (fights, clothes, the line) and `scripts/test-i18n.mjs` (catalogs
keep their placeholders, lines and patterns translate, switching languages works). Everything that needs eyes, the
animations, the world, the interfaces, is still checked by playing the build; the latest pass
covered soundtrack switching, the dealer flow (text, app, meet, edge cases, save and reload),
entering and leaving every building, and the map against world positions.

## Saves

Saves carry a version. Loading runs `src/systems/migrate.js` first: a v2 save is brought up to
v3 by letting each system build its own state block with its defaults (life, Rolo's orders,
romance, the event scheduler, the clinic and its course, rent history), so old saves keep
working. Every load also clears in-flight locks, a payment, a dose or a fall that was mid-way
when the game saved, so a reload can never leave Mo frozen.

## Known limitations

- The site is served with long cache lifetimes, so a player can briefly mix old and new files
  after a deploy. New code is added in new modules (or reached through optional calls) so a
  stale file degrades a feature rather than stopping the game, but a hard refresh or a cache
  purge is the clean fix.
- Unit 3B has no track of its own in `/Music`; it uses *Lost Time*, which it shares with the
  street at night.
- Rolo only meets on Kestrel Street. Ordering from inside a building works; he waits outside.
- The animations (substance use, the collapse fall, the dance), the hearts and the live-in
  partner were checked by stepping the game in a browser and reading their state, not by watching
  them play in real time; how they look still wants a human eye.
- Diana's gift pool includes the item called "Grandad's Watch", an odd present from her; the
  item exists, so it is delivered, but it may want its own gift item.
