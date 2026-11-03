# MO: FUNCTIONAL — Development Log & Handoff

> **Status:** Milestone 1 complete — playable vertical slice of all four requested phases.
> Version `0.9.0-m1` · Three.js r169 · no backend · no build step.

This file is both a changelog and a handoff document. If you are another model or
developer picking this up, read **Directives**, **Architecture**, then **TODO**.

---

## 1. Changelog — what exists right now

### Unit 3B made over, a working TV, and ROX

- **The upgraded flat** (`buildApartment`) follows a loft reference: wood floors (`floors`), white
  walls with an exposed brick west wall and dark ceiling beams once papered, a second window on the
  east wall, drapes on both (`drapes`, colour from `home.DRAPES`, changed at the window with
  `drapesMenu`), a tall mirror (`mirror`), a grey sectional and a plank coffee table on the rug,
  shelves and frames on the brick, and the TV on the east wall (flatscreen over a ribbed cabinet,
  or the CRT on its crate). With the Decorator's Guide, a magazine sits on the desk by the laptop
  and the Fix Up menu moves there.
- **`ui/tv.js`**: every clip is a `draw(ctx, t)` on a 96x54 canvas. The world screen is a
  `CanvasTexture` redrawn at ~12 fps by the area tick while `home.tvOn`; `openTv` is the overlay
  (power, channel up and down, watch an hour); `playTube` loops a clip for a clicked MeTube video
  (`TUBE_CLIP` maps thumbnail families to clips).
- **ROX** (`substances.types.rox`, `homemade`): the hot plate opens `home.stoveMenu`; `cookRox`
  takes baking soda, water and one held substance (not ROX), two hours, and yields 3 (4 from Dex's
  uncut stock). Uses the title screen's glass pipe (`useAnim.rox: 'pipe'`). `s.high.kind` records
  what he took, and game3d now shows the `high` face expression while high (full strength for ROX).
  Baking soda and water are on Miguel's shelf. The game takes the ingredients and the time; no
  method is described anywhere.
- **`systems/supply.js`**: three connections (`DEALERS`: Benchy, Squeak, Dex) take ROX on
  consignment in person (`dealerMenu`, interactables appear once Mo has had ROX). `supplyNewDay`
  drifts `market`, sells, deposits Mo's cut with a text, and sometimes sets `stiff` (texts carry
  `supply: 'threat' | 'ride'` replies, resolved in `sms.js`). `leanOn` in person, or knock the
  man out: `onKnockout` (called from game3d's KO branch) pays back what he owes plus loot. Small
  chance a corner gets raided and the stock is lost.
- **Fiends** (`fiend`, `fiend_f`, act `fiend`, the high face): `addFiends` adds them while an area
  loads, at night (21:00 to 05:00) on the street, in the park and on the platform; `fiendMenu`
  sells ROX for $55 to $85 a rock, once per fiend per night, refused if a cop can see. They flee
  when `copSees(16)` or a Guardian Angle is running. By day one sleeps on alternate Houses tower
  floors and uses the ordinary sleeper loot.

### The corner men, and fairer heat

- **Yusuf** (`hookah`: navy turban, a beard to the chest, a kurta) sits outside Habib's at a small
  table with a hookah (`act: 'hookah'`, smoke clouds). **Papi** (white tank, gold chain) and **Tito**
  (guayabera, flat cap) play dominoes outside the bodega (`act: 'dominoes'`). `systems/papi.js` is
  the game's encyclopedia: people, places, and a "what is going on" page built from the run.
- **Cutscenes** (`world.cutscene`, input locked, posed after the NPC loop): punching Papi makes
  him stand and slap Mo over and out (`papiSmack`, then `collapseSequence('beaten')`); punching
  Yusuf brings out a rifle, one shot at the sky, and Mo runs half a block before control returns
  (`yusufWarning`). (Not `this.scene`, which is the 3D scene.)
- **Cops** act only on what they see: `copSees(range)` wants a cop on foot inside the area with no
  tall solid in between, or a cruiser passing close. A phoned-in report sends a cruiser rolling
  through, never a chase.
- **Guardian Angles** come only after five innocent knockouts inside five real minutes
  (`noteKO(g, def)`); dealers, muggers, the armed, attackers and cops do not count.

### 1120 Kestrel, top to bottom

- **The building.** `world/hall.js` is four floors now, by `s.b1120.floor`: a lobby (front door,
  tile, sconces, a chandelier, mailboxes, and 1A, Rae's, the only lobby unit), the 1st floor
  (Stephanie in 1B; her door is `places.stephanieDoor`, moved from 1104 5C), the 2nd (Kev in 2A,
  `calls.kevDoor`), and the 3rd (3B and the tenant storyline). Stairs cost a couple of minutes a
  flight; the elevator goes anywhere in one (`toFloor`). The street door opens on the lobby, the
  apartment door on the 3rd floor.
- **Roofs.** `world/roof.js` builds a walkable roof for 1120 (the door alarm broken, a taped
  "BROKEN · R.V." notice) and for 1104 (EMERGENCY EXIT · ALARM WILL SOUND), with a skyline of
  neighbouring roofs and water towers. Smoke a loosie, use what is in your pockets, sit in the
  lawn chair, or stand at the edge for clarity (stress down, morale up, once a day in full).
  Areas may set `fogNear`/`fogFar`; the roof is shot with the street's long lens.

### Seats that fit, ways to start, a shift to play, a home to fix, a block with weather, and the people in it

- **Sitting.** `world.seatTop(x, z)` casts down at a seat and returns the real top of whatever is
  there; Mo (`sit`) and seated NPCs (`pose: 'sit'` with no `y`, and Kev in the park scene) are
  placed with their hips on it, instead of a fixed guess that sank them into benches.
- **Modes.** `systems/modes.js`: Default, Fresh Start, Final Warning, Family First, Bad Week,
  Getting By, picked on the intro screen and applied to the fresh state (`s.mode`).
- **Playable shift.** `systems/shiftplay.js`: four counter situations from a pool of seven, each
  scored; `workShift(g, { played, score })` turns the score into a small pay change, a tip from
  Dale or at most one warning. "Work normally" stays.
- **Home.** `systems/home.js`: repairs and practical upgrades (shower, mattress, fridge, hot plate
  with batch cooking, a curb couch, the leak) and, with the Home Decorator's Guide from the
  newsstand, decor (flatscreen, desktop, real bed, wallpaper, rug, lamp, plant). `buildApartment`
  draws what is in `s.home.owned`; effects are shower time, sleep energy, morning morale.
- **Happenings.** `systems/happenings.js` + `ui/marquee.js`: blackout, heat wave, transit,
  block party, inspection. Scheduled ahead, foreshadowed by a text whose choices are saved ids
  (`{ prep }`, `{ inspect }`, resolved in `sms.replyOptions`), and shown on a marquee while live.
  `hours.setClosedOverride` closes shops for a blackout.
- **Square Up.** `systems/owes.js` and a phone app: debts both ways (cash, item, help, apology,
  shift), paid in full or part, done, renegotiated, or forgiven; fed by borrowing, calling out,
  covering for Kev, Family First, Mom, and punching somebody you know.
- **Music.** `systems/music.js`: notebook at home, Kev's four-track or a pawn mic, recording around
  the building's noises, CDs, Thursday open mic at Lucia's, selling CDs on Ashby, studio time.
- **Stories.** `systems/arcs.js`: Kev, Nia, Habib, Gloria, Dale, each a few texts over days
  (`{ arc, opt }` choices), each with several humane endings.
- **The building.** `world/hall.js`: 1120's third floor between the street and 3B (the door now
  opens onto it). `systems/tenants.js`: knock, convince, log the heat, hold a meeting, go to Rae
  alone or together; repairs and `flags.heatFixed` as the reward.
- **Recovery.** `systems/recovery.js`: Dennis as a support contact, evening routines that grow
  with practice, invitations (go, leave early, decline), a check-in back onto the course
  (`flags.returnEarly`), and small messages when the clean days add up; a setback restarts the
  count, never the history.

### Kicks, robes, cans, hats in the air, a dog in the park, and traffic with intent

- **The park.** Kev's standing double is gone (calling him for a joint no longer puts two of him in
  the park). An old man (`chessman`: white beard, glasses, a flat cap) sits at the chess table
  over a real board, pieces mid-game and the bottle-cap knight; "Play chess" is against him. The
  pigeon lady sits on the far bench.
- **The phone.** The home screen has category tabs again (Street, Money, Life, After Dark) and an
  ALL tab that is the app drawer, every app including the dock's; Tweaks can switch home to one
  page of everything. New Phone settings: wallpaper (thumbnails), dim, 12/24 h clock, icon names,
  widgets. `ui/wallpapers.js` holds five stock wallpapers, Snapz photos (`world.snapshot()` reads
  the frame, crops 3:4, keeps nine JPEGs in `s.phone.photos`) and memories that unlock with the
  run: Chairman, Meatball at full trust, each girlfriend, the first shift, Nia as kids, a cloud of
  smoke, a booking photo, a suit. Memories are SVG around the HUD portraits, so they cost nothing
  in the save.
- **Kicks.** `kickPose`; the dog's menu and Chairman's have "Kick him." The dog yelps, hops and runs,
  and loses trust; the cat yowls, flies (`updateCatKO`) and lies out cold for a while.
- **Addison.** He is punchable (two hits): down on his own carpet, robes to go through once a day,
  for cash and a drop in Fellowship stage and standing. "Follow his guidance" in his menu plays his
  movement ministry (arms up, a slow turn) with Mo dancing beside him, for favour.
- **Punchables.** An area can list `punchables`; Dee's two machines clang and sometimes drop a can
  that sits on the floor until it is picked up. Cars can be punched: a parked one screams, a
  running one stops and its driver may get out and come for Mo.
- **Attackers.** `world/assailant.js` runs somebody at Mo until the fight meter opens; win and they
  are down with pockets, lose and it is the clinic. Three knockouts inside a couple of hours
  (`noteKO`) and a Guardian Angle comes; beat one for change and a pamphlet.
- **New faces.** Hasidic men (shtreimel, sidelocks, long coat) and the Guardian Angles (red berets,
  red satin, a patch on the back) walk Kestrel Street, Ashby Ave, Park Slope and Fulton as ordinary
  pedestrians. Anybody with a hat (`rig.hat`) loses it when they go down: it flies and lands.
- **Meatball in the park.** At Mo's heel when he walks into Kestrel Park, the dog comes in with him
  and wanders the paths; a mugger with the dog in sight is run off before the menu. He waits
  outside anywhere else.
- **Traffic.** Lanes may have `speeders` and `chases`: fast cars, and a car with a cruiser on its
  bumper, siren and all. Fulton's road is walkable now; a fast car brakes for a man who just
  stepped out, not for one who has been standing there, and one that hits him throws him over the
  hood (`hitByCar`, `updateFlung`).

### The phone grows a dial tone, cops with a job, an arcade, a catalog, pictures

- **The freeze.** A punch at the bodega cat threw inside the guard pose every frame and the loop
  never booked its next frame. `throwPunch` handles the cat on its own (a toast, morale down),
  `brawlPose` skips rigs without arms, and `main.loop` books `requestAnimationFrame` first and
  wraps the world update in try/catch, so one bad frame can no longer stop the game.
- **One home screen.** Every app is on a single grid (`APP_SHELVES` is one shelf), with Txtr,
  Phone, Shale Pay and GrubHope in the dock. Company senders that are not people get a badge of
  their own initials (`SERVICES`, `serviceFor`) instead of Mo's face.
- **Phone.** `systems/calls.js`: CONTACTS and KEYPAD. Mom, Nia (asks her over), Kev (a joint on a
  park bench, with the drags, then home high), Dale, Rae ("I'll get right on that"), the women
  Mo has met, Rolo and Dex (who do not do phones), the clinic and relief office (appointments),
  Jay's order line, 911, and keypad numbers worth dialling (411, 311, 867-5309, a prayer line, a
  psychic, the operator).
- **Delivery.** `systems/delivery.js` + `world/courier.js`: one order at a time from Miguel's or
  Habib's, a courier at 1120's door who texts on arrival and leaves after an hour, or a bag on the
  stoop if paid ahead, with a chance it walks off.
- **Cops.** `world/patrol.js`: a 911 call puts an officer on a two-minute beat. He breaks up
  muggings and fights, pats down the Houses' dealers, trades shots with the armed one, and comes
  for Mo if he sees him going through a body's pockets. Knocked-out and sleeping NPCs can be
  searched; a sleeper may wake up swinging.
- **Arcade.** `ui/arcade.js`: Eviction Snake, Pac-Mo: Debt Eater and Roach Invaders on three
  cabinets in Dee's, a quarter a play, keyboard or a touch pad, high scores in `s.arcade.best`.
- **Jay's catalog.** A dollar at the newsstand sets `flags.jaysCatalog`; Jay's order line appears
  in Contacts, and `wardrobe.mailOrder` puts the outfit in the closet at 10:00 the next day
  (`tickMailOrders`), with a note from Jay.
- **Pictures.** `ui/pinups.js` draws a woman in a pose (selfie, hips, peace, behind the head, a
  kiss, a cat held up) in a room, face in frame, with a pixel mosaic over the chest and lap.
  Buying from LonelyFans now texts the picture (`pushMessage` takes `pic`); the thread shows it,
  a tap opens it full screen, and her thread has its own replies. DialUpDelights draws six such
  thumbnails a page, one with the cat, under banner ads.
- **FeedLove.** Selfies and lip-sync videos (a frozen frame with a play button) post to Mo's
  profile. Every post has comments (`systems/feedtalk.js`: seeded strangers with a temper, a bio
  and a face); tapping a face opens their profile, and ARGUE starts three rounds of replies.
- **Txtr.** Friends get plans, venting, chain letters and a chance at twenty dollars; girlfriends
  get pickup lines, "I miss you", her day and goodnight, each with answers that vary.
- **The towers.** After five one of the women smokes outside her tower, the tower doors say whose
  light is on, the lobby mailboxes list them, and the lady in the lawn chair points the way.

### Seats, rooms you walk into, the Houses opened up, a guide, and touch

- **Seats.** An area lists `seats` ({ x, z, rot, y, label }) and gets a "Sit down" prompt in front
  of each; an interactable can carry `seat` too, and Mo sits before its menu opens. Seated, he
  rests (stress down, a little energy back) until a step or a tap stands him up where he came
  from. Benches, pews, desk, waiting and laundromat chairs, the bus stop, the platform.
- **NPC heights.** `npcs[].y` lifts a rig (the sleeper lies on his platform bench, the cat sleeps
  on the lottery machine, the token clerk sits on a tall stool, she lies on her bed). Rigs keep
  `baseY` so idle animations add to it.
- **The station.** The token booth is hollow with clear plexiglass and a transit clerk inside; the
  grey slab by the Kestrel stairs was a solid "handrail" panel and is now posts and a bar.
- **Waking up.** `world.freeMo()` releases every lock (eating, handoff, substance, dance, seat,
  collapse pose, `flags.consuming`) when he wakes at home or the clinic, and movement lets him
  walk out of any solid he starts inside.
- **Camera.** Small rooms (no traffic, under 140 m², no camBounds of their own) are shot cutaway:
  the eye may go 1.5 m past the walls and `cutaway()` hides any large mesh between the lens and
  Mo each frame, so a doorway is an over-the-shoulder shot, not a look down at his head. Walking
  at the camera indoors for half a second turns the view round, with the held direction kept on
  its old basis until the input changes. Chain-link (`seeThrough` solids) never stops the camera.
- **New rooms.** `world/rooms.js`: Unit 3B's bathroom (toilet-tank stash in `state.stash.toilet`,
  broken shower, sink) and the Quik-Stop restroom. `world/storefronts.js`: Ashby Pawn & Gold
  (Benny, glass cases, daily stock; buys and sells valuables and gifts, never food or
  substances), Mr. Jay's as a walk-in store, and the Civic Relief office Downtown with queues that
  move one person at a time and window 3 for recertification (or a new application).
- **The bodega** has two aisles, a bread rack and a lottery terminal with scratch-offs and nightly
  numbers; the cat sleeps on it.
- **Kestrel Houses.** `world/houses.js`: the court is fenced on four sides with a working gate and
  a real hoop, and `Hoops` runs a two-on-two (dribble, pass, shoot, rebound, possession changes).
  The North and East towers are six-floor areas (`pjtower`, stairs only) with neighbours and three
  women after dark; a visit fades out, costs time and money, can leave the clap (never
  accusable: `accused`/`posted` are set), and ends in her room (`pjroom`) at the foot of the bed.
- **The sax player** is `rasta` (tam with locks, shades, heavyset) with a fuller playing
  animation, and his "Stand and listen" plays the next track of the soundtrack in order, held on
  Ashby via `soundtrack.cue(id, seconds, area)`.
- **Guide and touch.** `ui/guide.js` shows six illustrated pages at the start of a run and is How
  To Play from both menus (controls on the last page). `ui/touch.js` adds a thumbstick and buttons
  on phones and tablets (`(hover: none) and (pointer: coarse)`), and the HUD compacts for them.
- New characters: transit, rasta, pawnbroker, baller1–4, wg1–3, caseworker, shopclerk; new
  textures: chainlink, court, hawaiian, rastaKnit, clothes, sneakers, groceries.

### Español and Deutsch

- A language setting: English (default), Spanish and German, from the title screen's Settings,
  ESC → Options and the phone's Tweaks. Saved in `localStorage` (`mof.lang`) and applied before
  the title screen draws.
- `src/i18n/i18n.js` translates the DOM as it changes (text nodes plus placeholder, title and
  aria-label), with exact lines first and `{0}` patterns for template literals. The canvas world,
  street signs included, is untouched. Catalogs are lazy-loaded the first time a non-English
  language is picked.
- About 4,300 English lines are catalogued, and 92% of them are translated in each language.
  What is left is proper names, app names and code the scanner picked up.
- `scripts/i18n-catalog.mjs`, `i18n-merge.mjs`, `i18n-scan.mjs`; `npm run i18n`;
  `scripts/test-i18n.mjs` (13 checks) runs with `npm test`.

### The underground restored, and the block stops interrupting

- The station, Park Slope, Downtown, Kestrel Houses and the Tunnel are `world/underground.js`
  again (silver K local that stops and opens its doors, an express that does not, rats on the
  track bed, roaches on the wall, the token booth, the AUTHORIZED PERSONNEL door). `district.js`
  keeps only the shared entrance and the closet. The entrances keep the real shaft on Kestrel (a
  painted well on Ashby) with green picket railings, round globe lamps on two posts and the sign
  on the back rail. Mr. Jay's sells whole outfits through `systems/wardrobe.js` (five more in
  `CONFIG.outfits`). `CONFIG.subway` carries the train timings, stops, the bench prices, the
  Tunnel purse; `CONFIG.jobsExtra` the café, dog and day-labor gigs.
- Outfits showed nothing: `applyOutfit` set `m.color` on a shader material (the colour is
  `uColor`) and its clone froze the shared light/fog/time uniforms. Fixed both.
- Street encounters (`systems/street.js` ENCOUNTERS) are people, not pop-ups: `world.spawnEncounter`
  walks one up the sidewalk, stops a step away with a prompt, and they leave if ignored for ~50 s
  or if Mo walks off. Witnessed scenes are feed lines. Each at most once a day, never twice
  running, 150 game minutes apart. Kev's, Nia's and Dale's events arrive as texts with reply
  chips. Life events: at most 2 a day, 3 game hours apart.
- Punching knows the new kinds (benchman is a dealer, the boxer is tough), and a punch on an armed
  man can be fatal.

### Review of the district / HailMary chase work, and fixes on top

- HailMary pull-off: rolls west (the way it leaves) instead of east then U-turning; keeps its
  heading when parked (it snapped to east on arrival); its camera solid follows it; the whole
  wait, grace window and chase pause while any menu is open; "Get in" during the pull-off counts
  as the catch and sits at the door with the catch's 1.5 m reach; Mo's reply and the stumble share
  one feed line. While the car is on screen it holds `ride.leaveAt` open: the 15 game-minute
  limit (about 7 real seconds at 1x) used to cancel the ride before the two-minute wait or the
  chase could ever happen. `rides.pullOffCruise` with `CONFIG.rides.chaseRamp` 0.3: a committed
  run from up to ~5 m back catches it as late as ~4.4 s (at the old 0.4, never after ~3.1 s).
- Fight meter: no swings once a fight is decided (each extra swing paid the purse or loot again).
- Brawl: `chain` (not an item) is `necklace`; a body is searchable once a day, not once a run per
  key; loot toasts show item names. Women and anyone Mo is seeing run at the first punch (a
  partner loses 60 affection; a girlfriend or live-in breaks up). The dog and the bike kid are
  reachable targets (kick: like down, the dog runs; the kid is refused). Fled people's prompts use
  `hidden`. A chasing cop runs at `brawl.copSpeed` 2.2, gives up after 4 s more than 12 m behind,
  and is removed on an area change (the old rig could arrest Mo in the next room). Punch on L3.
- One giving system: the Blessed+ app buttons and the church box go through `fellowship.donate`,
  which pays the tithe first, keeps the Shepherd's tally and moves the stage (the tally alone moved
  nothing). The phone and laptop close before a substance or a loosie. Area loads clear the
  consuming lock and let go of a held hand. The HUD clears the unavailable style with the prompt.
- Park Slope: a dishwashing shift at the Slope Diner and a dog-walker board (`CONFIG.slopeJobs`);
  the diner no longer turns away a man who can afford coffee. District areas have titles.

### Quality of life

- Prompts: World collects every interactable in reach (`nearList`, `pickIndex`), `X`/pad X
  cycles (`cycleTarget`); an interactable may define `unavailable(g)` → reason, shown as
  "Unavailable: …" and refused on F. HUD shows F or Ⓐ by last device, and "X n/m".
- `world/hours.js`: HOURS, openAt, closedReason; doors and rides respect it.
- `ui/today.js`: todayItems (rent, shift + grace, bills, clinic, Rolo, ride, Nia, service, odd
  jobs, goals), wouldMiss, confirmSleep (bed and phone), addGoal; HUD `.hud__today` (T toggles),
  `.hud__timestate`; `setSpeed` warns. iDread pins goals.
- `ui/nav.js` + map.js: destinations by category, search, open/closed, `state.nav`, route
  polyline, today "!" markers, minimap heading; `g.navigateTo(id, openMap)`.
- 1104: area `title` (Floor n/5) used by mapTitle; DIRECTORY in the lobby and the elevator.
- `ui/notify.js`: groupOf/groups/shouldPop; phone home notification center; settings
  feedBubbles / textPopups / placeToasts; feed counts unseen, CLEAR button.
- `world/pathing.js`: 25 cm walkability grid per interior, BFS + line-of-sight smoothing;
  patrolIdle uses it indoors.
- Inventory: sort by kind / value / A–Z (`settings.invSort`), item count, resale estimate,
  effect lines (`effectLine` in phone.js). Fridge: `CONFIG.fridge.capacity` 24, `moveFood(g, id,
  to, qty)`, ALL per item, Store all food / Take everything.
- Shop board: "you have N" (pockets + fridge) and food per dollar on each card.
- Saves: `savedWhere`, `slotInfo` time/where/auto, `saveAge`, `slotLine`; autosave labelled in
  the load screen and in Tweaks.
- `systems/relations.js`: daily snapshot (`relSnaps`), recentChanges (trust as words only),
  waitingOnMo; LoveLine opens with "Waiting on you" and "Lately".
- `ui/options.js` from the pause menu: music / SFX, camera distance/height + reset, controls table
  with gamepad column. `input.js` BINDINGS, keysFor, rebind (swaps), resetBindings;
  `settings.keys`; V / R3 reset the camera (`world.resetCamera`); HUD prompt shows bound keys.
- One screen at a time: `g.uiBusy` (pause, debug, phone/laptop, Modal, any overlay); overlays are
  a named set (`g.setOverlay(name, on)`) so closing one never clears another. `tickDealer` and
  `world.update` run as background (`g.inBackground`); `openModal` from background while busy goes
  to `g.deferred` (max 3) and opens one per frame once the screen is clear. World `canMove` is
  `!g.uiBusy`, so muggings, cop stops and street events also wait.
- `ui/icons.js` redrawn: 64-unit low-poly solids (box, can, band, cup, roll) with lit/mid/dark
  faces, outline and ground shadow; every CONFIG item has its own art (`ICON_IDS`, tested). Item
  tiles are green reference-sheet cards.
- Kid on the bike is a `createNPC('kid')` rig (face texture, red cap) posed on the saddle and
  pedalling; Meatball rebuilt from faceted solids; the newsstand gets a vendor (`newsman`, moustache
  beard style), a rolled shutter, corner posts, hanging magazines, side racks, a candy rack, tied
  bundles and a tube light.
- Smoking (`eating.js` style 'smoke'): two drags, the hand comes away between them, ember wisps
  while held and a billboarded exhale plume from the mouth after each drag.
- 90 checks.

### Dee's Wash & Fold

- `buildLaundromat` / `buildLaundryBack` (places.js), a front on Ashby; items soda, water, chips.
  Acts: fold. NPC defs can carry `scale` (the kids).
- `market.PROPERTIES.laundromat` ($60k, flat 780, upkeep 190, a 30% weekly repair); property
  `level` multiplies the weekly take by 1 + 0.15 per level; `market.launder` (owner of the
  laundromat only; `CONFIG.laundromat.upgradeCosts`, 8% fee, a 4% audit with a fine).
- Dee texts the week's take; rides and the map know the laundromat. 58 checks.

### Keys in dialogs, the bus stop, the police, the payphone, night scenes

- `Modal`: a highlighted choice (`.choice--sel`), F/Enter/Space/E pick it, W/S/arrows move it,
  1-9 pick directly; ignored for 200 ms after opening, for key repeats, in text boxes and while an
  overlay (fight meter, shop board) owns the keys.
- Bus stop moved to the curb by the park crosswalk (shelter, bench, B44 sign; the traffic light
  moved to the crosswalk corner); spawn, landmark and Kev's lunch spot follow.
- `systems/police.js` (search once a night when high; book: confiscate every substance, fine
  up to $250, a night in holding, out at the precinct). World: `copNear`, `copStop`,
  `toHolding`; muggings in sight of a cop are broken up. Park patrols at night
  (`CONFIG.police.parkChance`). `buildPrecinct` and a precinct front on Ashby; rides go there.
- New painted kinds: drifter, hall_m, hall_f, cop, cop2, inmate. Acts: pee (stream prop),
  lean, kneel (mosaic prop), phone, talk.
- The payphone menu (coin return, the stash behind the box, Dex's ringing call).
- 57 checks.

### AutoPay, street life, Meatball

- `economy.runAutopay/setAutopay` (`state.autopay`): on the new day (and when switched on) pays
  due bills through `payBill`, texts from SHALE PAY; insufficient funds once per bill per day.
- `world/streetlife.js`: `applyAct` (dice, watch, argue on a shared clock, smoke), a billboarded
  smoke pool, Meatball (`state.dog`: feed twice a day, +20 like, follows at 60, `fights.dogSave`
  at 100), events (patrol car via `Traffic.spawnSpecial('police')`, a bike, flavour toasts).
  Street NPC defs by hour in buildStreet; walkers wait for Mo.
- Fire escapes: the Quik-Stop's is off to the side above the awning; the Fellowship's is gone.
- 56 checks.

### Cars and traffic

- `world/vehicles.js`: extruded side-profile bodies (compact, sedan, taxi, coupe, convertible,
  gt) plus a bus; `randomCar` mixes types and 1999 colours. Used for parked cars, traffic and the
  HailMary car.
- `plan.js ROAD`: near/far parking lines and two lanes; parked spots clear the crosswalks; the
  HailMary pickup slides into the nearest gap (`freeCurbX`).
- Street: walkable road (bounds maxZ 10.8), a far sidewalk with a gate into the park, parked cars
  as low (camera-ignored) solids, `searchCar` at night (once per car per night; locked, change,
  food, loosies, a valuable, or the alarm).
- `world/traffic.js`: spawn at the ends, keep a gap, stop for Mo in the lane, honk (new `honk`,
  `honk2` sfx), moving solids so Mo cannot walk through cars. Kestrel and Ashby both have it.
- 55 checks.

### Crossing the street; HailMary

- A parked car sat on the park crosswalk (x 9.6), blocking the crossing and the camera; both
  parked cars are on the far curb now. `World.playCross(x, toZ, onDone)` walks Mo over the
  stripes (camera swings behind him) and then loads the park; used by both crosswalks.
- `systems/rides.js` (call, pickup at the curb out front, tick: arrive / wait / no-show fee,
  fares, same-block refusal with a stop fee, ride = advance + goTo to the door) and
  `world/ridecar.js` (RideCar: parked on a fresh load or driving in, a camera-only solid while
  parked, "Get in the black car", the destination menu). App `ride` in sites.js. 54 checks.

### Credits, employment checks, the lot; hookups and the clap; the laptop; TradeHarder; fights; Amazin'

- Credits name XiØN; work-of-fiction and real-life drug-use disclaimer (SAMHSA line) in the
  credits and README. Dale's talk branches on `job.employed`; the HUD objective swaps GO TO WORK
  for FIND WORK when unemployed.
- Street extended east to x 31.4: the lot (`lotDice`), crosswalk, park `eastgate` both ways.
- `systems/health.js` (the clap: infect, healthTick drain, treatClap at clinic reception,
  accuse via an sms reply on her thread, postAboutHer onto `state.stoopPosts`).
  `dating.hookupMenu` (hers/his), more `open` women, `risky` doubles the chance.
- `systems/block.js`: postToStoop, a daily gig, a daily stoop sale; NextStoop POST tab.
- `ui/sites.js` (installSites on Phone): investView, shopView, tubeView, boardView, xxxView,
  webView, stoopPostBody, siteActions. `ui/laptop.js`: Laptop extends Phone with a laptop shell;
  `g.openLaptop()`; `phoneOpen` covers both.
- `systems/market.js` (seeded per-save price walks, buy/sell with fee, properties, weekly rent
  on new day, tenant trouble and actions). `systems/shop.js` (catalog at retail, next-day
  delivery). `systems/fights.js` + `ui/fight.js` (FightMeter) + World.startMugging / playPunch;
  clinic takes 'beaten' collapses.
- 53 system checks.

### Threads, Gus, the camera; 1104, the bus, Ashby, Lucia's; HardLuck Bet; Nia

- **Txtr**: messages are grouped into one thread per contact (`threadKeyOf` = sms identity
  name); the thread shows every message with Mo's replies and day separators; reply chips answer
  the newest. Message history 150. App women resolve to their own faces.
- **Gus**: placed at his schedule spot on load (all street NPCs are); `pose` comes from the
  schedule row (sleep only on the cardboard), not from `sit` everywhere; talk() has Gus and junkie
  menus (a dollar, a story).
- **Camera**: `area.camBounds` (the street's runs over the road); thin solids (<= 0.5 m) do not
  block the arm; no auto-swing indoors (higher arm instead); gentler pull-in rate.
- **places.js**: `buildWalkup` (floor in `state.walkup`, stairs reload the area with a spawn,
  knocks once per door per day, Petrakis, Squeak's daily stock, couple, Stephanie's 5C, roof),
  `busMenu` (fare, wait, ride or walk), `buildAvenue` (walkers, sax, newsstand, pawn),
  `buildRestaurant` (menu; romance activity `lucias`). NPC defs `still` + `pose`, `walker`;
  `area.tick` per frame; `area.enterToast`. Street extended west to x -25.4.
- **systems/casino.js** + app `casino`: honest slots (RTP ~0.93, tested), blackjack, roulette;
  free first bet; stress when chasing a losing day.
- **systems/sister.js**: bond `npc.nia`; `nia_visit` texts with yes/no replies; visit window,
  presence in Unit 3B, `eatWithNia`, food left as `nia_meal` if missed.
- 48 system checks.

### FeedLove grows up; NextStoop; the debug password

- **Debug**: on layouts where `~` is a dead key the opening keystroke lands in the password box
  ("~Moses") and the strict compare failed silently. The prompt now clears a leading ~/` and the
  compare is letters-only, case-insensitive.
- **FeedLove** (`systems/social.js`, `ui/feedart.js`): accounts with handles, posting rhythms,
  lines and picture scenes; a seeded timeline over the last 3 days (pre-game days included) that
  never shows the future; follow/unfollow; who follows Mo (family, friends, the three once she
  likes him); likes both ways (her post: affection once a day; his post: `likesForMoPost`).
  Tabs FEED / PEOPLE / HEARTS / LOVELINE; a text box (Enter or POST) beside the random post; the
  phone keeps its scroll position and draft across re-renders and isolates typing from game keys.
- **NextStoop** (`systems/block.js`, app id `block`) replaces LoveLine on the home grid: live
  sightings from the schedules, a seeded daily board, 14 lore entries unlocking one a day.
  `openPhone('dates')` now opens FeedLove on its LOVELINE tab.
- 45 system checks.

### The twenty app women: faces, hookups, run-ins

- `assets/ref/app_women_bank.png` (owner's 5x4 sheet) baked as `w0`..`w19` in `NPC_FACES`.
  `core/strangers.js` is the roster: name, age, hood, bio, `open`, and a `look` that heads.js
  (face specs) and characters.js (CAST) read. New hair styles `bun`, `knots`; `shoulder`/`shag`
  take `hairLen`. `ui/thumbs.js` (generic SVGs) is gone.
- `systems/dating.js`: the daily stack is a seeded draw from the roster. Open women can match as
  `hookup` (`CONFIG.dating.hookup`): `hookupContacts`, `hookupAvailable` (22:00-03:00, cooldown,
  energy), `hookup` (flake chance; fade, 3 h, stats; a girlfriend may find out), and
  `addHookupContact` for run-ins. `d.seen` remembers what happened with each.
- `world/schedules.js` `strangerRunIns(day)` / `strangerTarget`: three a day, seeded, 90 min,
  09:00-21:15 starts, spots clear of the three. The world places them through the same presence
  code as the partners; `world/encounters.js` is the talk menu.
- 41 system checks (open/closed behaviour, hookup window and cooldown, run-ins).

### The three women, remodelled; schedules; hugs, hands and a kiss

- **Look**: `assets/ref/partner_face_bank.png` (owner's sheet) baked into `NPC_FACES` for diana,
  stephanie, melanie (explicit portrait boxes; the rest of the bank is byte-identical). Face specs
  recoloured; new hair styles `shoulder`, `shag`, `curls` (shell cap + `hangingHair` geometry;
  curls are icosahedra). Outfits: Diana grey tee and jeans, Stephanie black zip hoodie (`hoodie`),
  Melanie black tank (`tank`: skin shoulders, scoop, straps, no collar band).
- **Schedules**: `PARTNER_SCHEDULES` / `partnerTarget` / `partnerWhereabouts` in
  `world/schedules.js`. The world adds a rig for each of the three in the street, park,
  Quik-Stop, bodega and Habib's, shown only while her row names that area
  (`World.partnerPresence`); she walks in/out through the area's door when the row changes. The
  park no longer hard-codes them. Awake windows in `romance.js` match the schedules.
- **Affection** (`world/affection.js`): hug and cheek-kiss beats (Mo held, like the handoff) and
  hand-holding as a follow state. `romance.gesture()` pays once per kind per day
  (`CONFIG.romance.gestures`, `.gestureValues`); offered from `partnerMenu` once affection is high
  enough or she is his girlfriend.
- **Phone**: LoveLine shows "Now:" and her usual day; HEARTS strangers use `ui/thumbs.js` SVGs.
- 39 system checks (schedule coverage, awake-when-out, gesture once a day).

### Owner direction pass — the Fellowship ending, FeedLove dating, Dex, Rolo's arrival

- **History**: 696f145 (authored by the Codebuff workspace with Codebuff trailers) was re-authored
  as XiØN and main force-pushed with a lease; all commits are XiØN only.
- **docs/WISHLIST.md**: the owner's full feature list and direction, with status. Read it first.
- **The Fellowship** (`CONFIG.fellowship.titheByStage`, `.recovery`): the tithe rises with stage
  (10% → 20%); services from stage 2 lower dependence/withdrawal/tolerance; from stage 3 the
  routine eases withdrawal daily. Signing the pledge calls `finishEnding('pledge')`, rewritten as
  **Fully Functional** — the ironic, not-good ending. It is the only ending the game takes itself.
- **FeedLove**: heart icon and red palette (no Instagram look-alike). New `systems/dating.js` and
  the HEARTS tab: daily seeded stack, ten hearts a day, strangers mostly reject, the three match →
  `romance.meetPartner`, a text with her number, TEXT / ASK OUT from the app.
- **Dex**: schedule 18:00-04:00 with an `away` row; away NPCs are hidden and their talk prompt
  skipped. Uncut stock `bliss_x/static_x/mud_x/drip_x` (`dexOnly`, `badBatch` 15%,
  `CONFIG.substances.badBatch`), sold only by Dex; Rolo's catalog unchanged.
- **Rolo's arrival**: due → he appears only on a fresh street load (Mo goes inside and comes out);
  if Mo is outside he is texted to go in. `o.arrived` / `markArrived`; the three-hour wait starts
  at arrival; `showUpWindow` (12 h) before he gives up on Mo coming out. Map and phone show it.
- 36 system checks (dating, Rolo arrival, Dex stock, tithe by stage).

### Pass after the continuation — locks, the course, migration, Quik-Stop interior

Picked up at 696f145. Everything below was verified in a browser (the game loop stepped at a
fixed 60 fps, since the preview pane does not run animation frames while hidden) and by the
headless suite (now 31 checks).

Fixed (bugs in the previous pass, found on review):
- **Interrupted animations stranded the player.** `SubstanceUse.stop()` and `CollapseFall.stop()`
  dropped their completion callbacks. An area change mid-dose left `flags.consuming` set (saved,
  so it survived reloads) — movement locked, every later use refused, the dose lost without its
  effects. A fall cut short never faded or woke him and left `flags.recovering` set. Both now
  run the pending callback exactly once when stopped; a consuming flag with no animation behind
  it is released by the world; and turning points (life.js) wait while either lock is up.
- **`state.rentLock` was saved** and only a timer cleared it: a save made mid-payment reloaded
  with rent permanently "busy". Cleared on every load (migrate.js).
- **Street schedules applied in every area**: Kev in the park and Rae in the church were sent
  toward street coordinates and paced at the room's edge. Schedules now drive street NPCs only.
- **Talk prompts stayed at an NPC's starting spot** when a schedule moved them: each talk prompt
  is now tied to its rig and follows it.
- **Arrival prompts**: the clinic and the park put Mo inside their exit prompts on arrival (one F
  and he was back outside), and leaving the Quik-Stop put him inside its door prompt. Spawns and
  radii moved; every area was swept for prompts on arrival.
- **Soundtrack**: the park and the clinic were not mapped and fell through to the street logic.
- **Debug**: "give" pushed duplicate inventory rows; the event picker reset on every re-render.

Added:
- **Quik-Stop #14 interior** (`buildQuikStop`): aisles, coolers, coffee station, register with a
  clerk, customers by time of day, Dale in the back during the day, EMPLOYEES ONLY door with the
  time clock. Shopping goes through the shared menu board with a convenience markup
  (`SHOPS.quikstop.markup`); a new `coffee` item. The street door enters it; the soundtrack plays
  Quik-Stop inside. Mo can shop there whether or not he works there.
- **Outpatient course** (`clinic.js`: programState/programInfo/enroll/attend/onRelapse/
  clinicNewDay; `CONFIG.clinic.program`). See README "The clinic". `flags.wantsHelp` is the
  referral hook it was meant to be.
- **Save migration v2 → v3** (`src/systems/migrate.js`, `SAVE_VERSION`), wired into `applyState`.
- **Debug**: jump to day N (forward only), spawn/despawn a chosen NPC, reset NPC schedules
  (`world.debugSpawnNPC/debugDespawnNPC/resetNPCs`).
- Removed the unused `CONFIG.romance.giftItems`.

### Continuation pass — early rent, clinic, park, dating, debug

Built on top of the existing game without replacing anything. All new balance lives in
`CONFIG`; all new simulation is headless (`src/systems/`), and the world/UI only call into it.

- **Rent can be paid early.** `src/systems/rent.js` adds `payRent(g, { ahead })` and
  `rentStatus(g)`. Paying ahead bumps `bills.rent.paidCycle` one cycle, so the due date finds the
  cycle settled and nothing is charged twice; one cycle ahead maximum (`CONFIG.rent`).
  `state.rentLock` (300 ms) swallows double clicks. Payments are recorded in
  `bills.rent.history`, shown in the Banking app card and Landlordly.
- **Partner rent share.** `economy.rentShare()` / `rentPerCycle()` read
  `CONFIG.partners[id].rentShare` for the single live-in partner — one place, applied once, never
  stacked, never above 50%. Early payment, eviction arithmetic and the history all use it.
- **Substance animations.** `src/world/animations.js`: `SubstanceUse` picks a style from
  `CONFIG.substances[id].useAnim` (pipe / pill / drink / snort), and effects are applied in the
  animation's completion callback, so the item is removed once and the high lands after the
  visible use. Headless fallback applies immediately if there is no world.
- **Collapse and recovery.** `CollapseFall` plus `main.collapseSequence()`: fall, fade, lost
  hours, then home (beside the bed) or **Kestrel Clinic** when he has no home or has gone down
  twice. `clinic.js` owns treatment, the hospital bill, check-in and `shouldTakeHimIn()`; a
  five-hour lock and `flags.recovering` stop the loop.
- **Kestrel Clinic** is a real location east of Habib's (plan, street frontage, interior,
  map glyph, phone app). Nurse Okafor treats for $60/90 min or bills it.
- **Kestrel Park** is a real location across the road (plan + `PARK` export, half-court, benches,
  chess table, playground, boombox, NPCs, gate interaction, map). Leisure: sit, hoops, chess,
  music, **dance** (`playDance`), talk to Kev.
- **Dating.** `src/systems/romance.js` owns Stephanie, Melanie and Diana: flirt/chat with
  cooldowns, five priced date activities scored from personality + condition + history, Cheeks
  (fade to black, next morning), the 24-in-game-hour Afterglow, girlfriend status after three
  successful dates, gifts (one pending parcel, 3-day per-partner cooldown), moving in, and
  household behaviour (food, restock, sales). Hearts over the three women only.
- **SMS identities and replies.** `src/systems/sms.js`: `identityFor()` gives every sender a
  kind (person / business / service / dealer / unknown) and `replyOptions()` builds replies per
  category, so BidBay never gets "can we not do this right now".
- **Event scheduler.** `src/systems/scheduler.js`: weighted rolls, per-event cooldowns, minimum
  gaps, time windows, area and state gates, per-day caps and a saved `state.sched.log`. `events.js`
  delegates to it; family calls are no longer daily. Romance invitations use it too.
- **Hidden debug menu.** `src/ui/debug.js`: `~` → password prompt → `Moses`. Wrong password
  closes silently. Every action calls the real system.

### Art pass 3 — NPC face bank (owner priority)
- NPC portraits and 3D head textures come from `assets/ref/npc_face_bank.png`, baked by
  `scripts/bake-npc-faces.py` into `src/render/npc_faces_data.js` (JPEG data URLs: a 3:4 portrait
  plus a head-frame frontal per NPC, with landmarks measured per panel). Mo is unchanged.
- Head wraps for NPCs paint a fallback first and swap in the bank face when the JPEG decodes
  (`headCanvas` → `fillWrap`, texture `needsUpdate`).
- Looks follow the bank: Rae wears a purple durag (tails modelled), Habib a kufi, the homeless man a
  beanie, Nia long hair, Kev a blond quiff, Dex a fade + full beard, Miguel a fade + goatee, the
  clerk a side part + glasses. Shirt colours re-matched. Addison keeps the white suit (game lore).

### Art pass 2 — cast, HUD sheet, environment finish (owner priority)
- HUD: Mo's six moods come straight from the owner's sheet (`assets/ref/mo_mood_sheet.png`,
  baked by `scripts/bake-mo-moods.py` into `src/render/mo_moods_data.js`). Mo's 3D head texture
  is the sheet's CONTENT face (`scripts/bake-mo-face.py`).
- NPC portraits are painted (`paintPortrait` in `render/heads.js`) in the sheet's framing and
  planar style instead of rendered; the painter (`paintFrontal`) now builds faces from hard-edged
  light/shadow planes and a ramp derived from one skin colour.
- Bodies (`world/characters.js`): `loftGeo` multi-ring faceted limbs measured off the Mo model,
  knee/elbow caps (fixes the "chopped kneecaps"), sloped shoulders, short thick neck, tee hem over
  the waistband, straight-leg jeans, shaped fists, sleeves per NPC (`longSleeves`).
- Environment: `box()` is now a chamfered box (bevel strips + corner facets, BoxGeometry UVs);
  shader adds a contact shadow on vertical surfaces near the floor; textures paint at 2x with a
  fine grain layer; key light moved to the upper left-front; headlight fill reduced.
- Render config: internal height 240 → 336, dither 0.4, snap 170, wobble 0.6.

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

Owner direction pass (browser, stepped loop; plus npm test 36/36, check 56/56):
- Rolo ordered while on the street: due → text "go grab a coffee", no rig; into the Quik-Stop and
  back out → standing at the hydrant, Meet Rolo prompt, 179 min left.
- Dex at 13:00 hidden with no prompt; at 21:00 in the alley; menu lists the four uncut items.
- Pledge at the inner circle → "Fully Functional" ending screen.
- FeedLove HEARTS: 8 profiles, a stranger rejected, Melanie matched → contact + number text.

Pass after the continuation (browser, game loop stepped at 60 fps; plus `npm test`):
- `npm run check` 55/55, `npm test` 31/31.
- Quik-Stop: street door → interior → register board (ramen $1.40 → $1.89) → coffee ($1.69,
  +8 energy) → exit lands at the store door; music "quikstop"; camera sweep: 0 frames outside the
  room or inside furniture.
- Camera sweep (scripted walk + orbit) in apartment, bodega, Habib's, church, Quik-Stop, street,
  park, clinic: 0 frames outside any room; furniture contact only 2 frames in the park.
- Arrival sweep: no area puts Mo inside a door/exit prompt on arrival or on return to the street.
- Debug: wrong password closes silently; `Moses` opens; day 1 → 4; spawn/despawn Stephanie;
  schedule reset snaps a displaced NPC back; "give" stacks.
- Interrupted dose (area change mid-animation): effects applied once, lock released, Mo walks.
- Interrupted collapse: fade lifted, `recovering` cleared, woke at the clinic with the hours gone.
- Not verified by eye: how the new animations look in motion; touch input.

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

Verified headlessly in the continuation pass (`npm test`, `scripts/test-systems.mjs`):
- Rent: due-cycle payment, early payment settling the next cycle, no second charge on the due
  date, one-cycle-ahead cap, rapid-repeat lock, partner share (15/25/50) applied once.
- Dates: cost charged, time spent, outcome recorded; a bad date is not refunded.
- Three successful dates → girlfriend; Afterglow is exactly `afterglowHours` of game minutes and
  holds morale at max; one pending gift, opened once, one item added; Diana restocks once a day.
- Scheduler: cooldown blocks, family-call gap, per-day cap never exceeded.
- SMS: BidBay gets marketplace replies, every sender class has its own replies, unknown numbers
  get the placeholder, a reply is recorded once.
- Clinic: treatment lowers risk/withdrawal once a day; unpaid treatment becomes hospital debt;
  collapse goes to the clinic with no home or after repeated collapses.

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
- [x] **Camera collision**: fixed (725c537) — the arm marches out from Mo, stops at tall
      solids (colliders carry a height), pulls in instantly, swings with hysteresis.
- [ ] **Bed/sleep while phone open** — currently sleeping from the Calendar app works
      anywhere; restrict it to the apartment for consistency with the bed interaction.
- [x] **Save migration**: v2 → v3 in `src/systems/migrate.js`. Add the next step there.

### Medium priority
- [ ] More events: landlord inspection, health clinic visit, a second job offer, a
      roommate subplot, Chairman's vet bill.
- [ ] Fellowship stage 3 should visibly change NPC dialogue in the street (rumours).
- [x] Add a "recovery" path: **Kestrel Clinic** is now a real location with paid treatment,
      free check-ins, a hospital bill, collapse recovery, and a five-session outpatient course.
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

### Next up
- [ ] Visual random events (police car, ambulance, an argument, rain, a power cut) through the
      scheduler, with real NPCs and props rather than text.
- [ ] Pedestrians and NPC-to-NPC conversations on the street.
- [ ] BidBay marketplace: randomised listings, fluctuating prices, scams, item condition.
- [ ] Live-in partner pathing around furniture.

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

### Sender-aligned texts, one live-in, heartbreak, bribes, LonelyFans, phone shelves

- **The STOP bug.** Replying STOP to the Golden Fellowship produced a BidBay unsubscribe.
  `sms.applyAct('stop')` had `'BIDBAY'` baked into it; it now answers as `message.from`. The
  same hard-coding was in `open` (every service opened FeedLove), the clinic replies, the relief
  office's documents reply and the power extension — all now resolve from the sender.
- **Chips follow the message.** `contextFor()` adds the replies that belong to the text on the
  screen: a service notice gets service times and the pledge, an AutoPay receipt gets the switch
  that turns AutoPay off, a bill reminder gets an extension, an ended listing gets "what sold?".
- **One live-in, ever.** `askMoveIn()` with somebody already in the kitchen opens an override
  prompt instead of refusing silently; confirming calls `endLiveIn()` (girlfriend off, live-in
  off, heartbroken on, mood at 10, affection −46) and then moves the new girlfriend in. Her rent
  share follows `romanceState().liveIn`, so only one contribution can ever apply.
- **Heartbreak and the way back.** A heartbroken ex answers texts with two chips only: beg, or
  give her space. Begging is a roll — she may block him (`NOT DELIVERED` bubbles in the thread,
  "*She blocked you dude, yikes..*") or agree to one date. Blocked or not, the in-person route is
  `openReconcileMenu()`: an apology once a day, dinner, cash, flowers, chocolates, the ring. At
  mood 62 and affection 26 she is out of heartbreak, unblocked, and dating resumes normally.
- **Bribes.** High, holding and carrying $50, `copStop()` offers $50 (52%) or $100 (80%) before the
  search. A refusal books him anyway, with a $60 bribery penalty on the fine.
- **The crooked cop.** `police.crookedRoll()` fires once a night, 21:00–05:00, near a patrol,
  while high; `crookedCop()` sells evidence-room product at 45% off. One per night by design.
- **LonelyFans** (`systems/fans.js`): locked until subscribed at $2/day, renews at the day
  rollover through `economy.onNewDay` (AutoPay carries it or it lapses with a text), pictures
  lower stress and morale, a dignity gate refuses under 22 morale with "have some dignity man, hit
  the pipe or something instead!", and two of the four models offer more for $500. Described,
  never shown.
- **Phone shelves.** `APP_SHELVES` in `ui/apps.js` groups every app into four tabs (The Street,
  Money, Life, After Dark); the home screen shows one shelf at a time, so adding apps no longer
  lengthens a single scroll. A test asserts every app appears exactly once.
- **Save v4** creates the `fans` and `police` blocks and the partner heartbreak fields additively:
  an old save keeps its live-in and nobody becomes heartbroken retroactively.
- Checks: `npm run check` 80/80 modules; `npm test` 82/82.
