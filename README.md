# MO: FUNCTIONAL

> *You don't have to get your life together. You just have to keep it together.*

A dark-comedy, 90s-era **life-management simulation** about rent, shifts, dependence,
and the arithmetic of a Tuesday. Built with Three.js and vanilla JavaScript. No backend, no
build step, no install.

![Mo on Kestrel Street, with the block out around him](assets/img/street_life.png)

```
Mo has a job, a lease, a phone full of people who want things,
and a habit that has been quietly rewriting his week.
Rent is due on Friday. It is Monday. He does not have it.
```

---

## The MoPhone and the interface

The phone is the management screen, and it is built like a modern handset: a rounded metal
chassis, an island at the top, a gesture bar at the bottom, and a home screen with a lock-screen
clock, two widgets (Mo's current mood, and what is due next), an icon grid and a dock. Every app
is a **parody of an app you already have**, with its own name, icon, colours and layout:

| App | What it is | What it does |
|---|---|---|
| **Txtr** | the messages app | inbox and threads; companies text with their own app icon, people with their face |
| **Shale Pay** | the bank | a debit card with a live balance, bills, recent activity |
| **LinkedOut** | the job app | an #OpenToWork profile, the Quik-Stop shift, odd jobs |
| **BidBay** | the marketplace | list valuables, set a price, a mystery grab bag |
| **iDread** | the calendar | the week ahead (shifts, rent, power, service) and sleep |
| **GrubHope** | groceries | food for cash or Civic Relief credit, relief programs |
| **Pocket Lint** | the inventory | everything he carries, as illustrated tiles; eat, drink, sell |
| **Landlordly** | the smart home | a thermostat dial that counts down the days to rent |
| **FeedLove** | the social app | a profile ring, follower counts, posting for likes |
| **Blessed+** | the church app | the Golden Fellowship's "live" Sunday stream and the tithe |
| **Tweaks** | settings | skin, scale, camera, volume, saves, run stats |

**Themes and scale** live in two places: `SETTINGS` on the main menu, and **Tweaks** inside the
phone (so you can change them mid-run). Seven skins — Functional (CRT green), Amber (warm glass),
Ice (clinic blue), VHS (magenta bleed), Primo (indigo glass, cyan pills), Bodega (neon sign, 3am
grill) and Graphite (monochrome) — recolour the phone, the HUD, the menus and every panel from one
set of CSS variables. The interface scale is S / M / L, applied to the in-game UI layers only, so
the 3D stage never shifts. Both are saved with your run.

**Messages on the HUD** arrive as text bubbles in the bottom-right corner: they pop in, stay long
enough to read, and fade away. Nothing is thrown out. Hover the feed (or click its **MESSAGES**
handle to pin it open) and the whole day scrolls back up as a conversation, each bubble with its
sender, its in-game timestamp and a colour for what kind of news it is. Log lines sit between them
as small centred timestamps, like a real thread.

**The title screen** is a performance rather than a still. Mo stands in the corridor and scans it
slowly — left, hold, right, hold — then reaches into his jacket and brings out a small glass pipe
(a thin stem with a ball on the end). The stem goes to his lips and stays there, the ball clouds
over on the draw, he tips his head back and lets the smoke out of his mouth. Then it lands: his
eyes go red and heavy-lidded and one corner of his mouth lifts into a smirk, until the loop wraps.
The crowd walks past behind him the whole time — neighbours coming home, two of them stopped to
talk, everyone eventually swallowed by the fog. The loop runs on a single 26-second clock in
`src/world/title.js`, which overrides the idle pose after `animateMo` so the two can never argue.

**Typography** is part of the shell: Orbitron carries the machine voice (title, clock, money, app
headers, endings) and Chakra Petch carries everything meant to be read as prose. Both are
vendored under `assets/fonts` with their OFL licences, so the interface never waits on a network
font.

**The camera** is adjustable in **Tweaks** as well: distance (70–140%) and height (80–135%), plus a
reset, saved with the run. The follow camera is a spring arm — it shortens against walls, and when
Mo backs into a corner it swings sideways along the wall instead of tipping the view to a
top-down.

## The block

Kestrel Street is one block, and it is dressed like one: dark towers behind the shopfronts,
fire escapes and a rooftop water tank overhead, vertical neon blades and a bulb marquee at
street level, cars parked at the curb, a crossing with its own traffic light, trees in concrete
planters, a mailbox, a news box, a wall phone, and a steaming grate with the wet patch it leaves
on the walk. It is all built from the same box and plane primitives as the rest of the world, so
it dithers, warps and fogs with everything else in the frame.

## Play it

**Live:** <https://xiondigital.net/mofunctional/> — GitHub Pages, straight from `main`.
**Arcade:** <https://xiondigital.net/arcade/> — the hub tile that launches it.

No install, no account, no backend. Click **PRESS START**, headphones recommended.

The game is a static site. ES modules can't load over `file://`, so to run it from a
checkout, serve the folder:

```bash
npm start                 # python3 -m http.server 8080
python3 -m http.server 8080
npx serve -l 8080 .
```

Then open **http://localhost:8080** and click **PRESS START**.

- Desktop Chrome / Firefox / Safari. Keyboard, or a gamepad.
- Audio starts on the first click (browser autoplay policy).
- Saves live in `localStorage` (3 slots + autosave), scoped to the origin it is served from.

---

## Controls

Movement is camera-relative and positive-forward: **W always walks into the screen**, whichever
way the camera is turned, and Mo turns to face the way the stick points.

| Input | Action |
|---|---|
| `W A S D` / arrows | Move |
| Click / tap the floor | Walk Mo to that spot (a drag still orbits) |
| `Q` `E` | Orbit the camera around Mo |
| Mouse drag | Orbit the camera |
| `F` / `Space` / `Enter` | Interact with whatever is near |
| `TAB` | Phone (pauses time) |
| `ESC` | Pause / close |
| `1` `2` `3` | Speed 1× · 2× · 4× |
| `C` | Toggle CRT scanlines |
| `R` | Toggle 4:3 framing |

**Gamepad** (standard mapping, plugged in at any time — the HUD toasts when it connects):

| Button | Action |
|---|---|
| Left stick / D-pad | Move |
| `LB` / `RB`, `LT` / `RT` | Orbit the camera |
| Right stick X | Orbit the camera |
| `A` | Interact |
| `B` | Phone |
| `START` | Pause |
| `X` / `Y` | Speed 1× / 2× |

The HUD has the same controls as buttons. On the phone, the bar at the bottom goes home and the
× puts it away; in the fridge and the shop boards, `ESC` closes them.

---

## What's in this build

### A cast with one design language

Every character — Mo, Addison, the neighbours, both shopkeepers, the men on the street — is
built the late-90s console way, measured off Mo's reference model (`assets/ref/`): a ~6.4-head,
broad-shouldered figure whose limbs are **lofted faceted tubes** (calf, bicep, chest and the hang
of the tee are shaped by extra rings; every facet keeps a hard normal), with **joint caps** at
knees and elbows so nothing opens up when a leg bends, and a **low-poly skull wearing one
wrap-around face texture**. Mo's head texture is the CONTENT face from his mood sheet; everyone
else's is painted in the same planar style and framing, then wrapped onto the identical skull.

![Mo, full body](assets/img/mo_character.png)

![Mo's head in game: front, three-quarter](assets/img/face_check.png)

![The cast](assets/img/faces_cast.png)

### Mo's face on the HUD, in his current state

The panel top-left is Mo's face from the owner's **mood sheet** (`assets/ref/mo_mood_sheet.png`):
**CONTENT**, **WRECKED** (tired), **STRESSED**, **HIGH**, **SICK**, **SEETHING** (angry), swapped
when his state changes. NPC avatars in the phone and text threads come from the owner's **NPC face reference bank**
(`assets/ref/npc_face_bank.png`), and the same faces are projected onto each NPC's 3D head.

![HUD faces by mood](assets/img/hud_state_faces.png)

![NPC heads in 3D, textured from the face bank](assets/img/npc_heads_3d.png)

### Text threads that answer back

Incoming messages arrive as an SMS overlay with the sender's face on their bubbles and Mo's face
on his; companies (BidBay, the Golden Fellowship, Civic Relief, Shale Mobile, Municipal Power)
use their app icon or seal instead of a stranger's face. When a message asks something, the thread
waits for an answer — and the option Mo picks is posted into the thread as a sent bubble, then
filed in Txtr, where the whole conversation stays readable and repliable.

![A text thread with Kev](assets/img/hud_text_thread.png)

### Kestrel Street, alive

Six neighbours run daily schedules: Dale unlocks the store, works the counter, smokes by the job
board and goes home; Kev takes lunch at the bus stop and drinks on the bench at night; Rae does
her rounds and argues with a contractor; Dex holds the alley after dark; a man named Gus beds down
on cardboard by the bodega and sorts cans in the evening; a man you only nod at drifts between the
bench, the alley mouth and his cart. Random street encounters — panhandlers, a watch guy, a
preacher with gold-edged leaflets, spilled groceries, skate kids, the alley at night — interrupt
with real choices.

### Two counters, two economies

Both shops open a **menu board** instead of a list: the owner's face and a line of his, the cash
you have, and a card per item with its illustration, a price tag, chips for what it does to Mo
(food, energy, morale, stress, hot), and the owner's note. Click a card to buy; it stamps
**BAGGED** and the board stays open, so a breakfast run is three clicks.

**Kestrel Bodega** (Miguel): bacon, egg and cheese, a chopped cheese, a hero, loosies from under
the register, tall boys from the back cooler. Cheap, salty, pork-forward.

**Habib's Corner** (Habib): halal only — no pork, no loosies — chicken over rice, a combo plate,
lentil soup, falafel and baklava. Roughly a third more expensive, and the food actually restores
him: the halal plate is the best hunger/energy buy on the block, falafel is the cheap option.

| | Bodega | Habib's |
|---|---|---|
| Bacon, egg & cheese | $4.50 · +44 food | — |
| Chopped cheese | $6.50 · +58 food · +11 morale | — |
| Chicken over rice | — | $9.50 · +60 food · +26 energy |
| Halal combo plate | — | $10.50 · +62 food · +27 energy · +9 morale |
| Falafel wrap | — | $4.00 · +36 food · +14 energy |
| Loosies | $1.50 · −9 stress | — (not sold) |
| Tall boy | $2.75 · −12 stress · +5 morale | — |
| Mint tea | — | $1.50 · −5 stress · +3 morale |

![Inside the bodega](assets/img/bodega_interior.png)
![Inside Habib's](assets/img/habibs_interior.png)

### The fridge, and eating on screen

The fridge in Unit 3B is **storage**. Opening it shows two shelves side by side — what is in the
fridge and what is in Mo's pockets — and food moves between them one item at a time: **STORE** it
for later, **TAKE** it for the road. He starts the week with groceries in the fridge and a pack of
ramen in his pocket. Anything edible can be eaten from either shelf, or straight from Pocket Lint
on the phone, wherever he is standing.

Eating is something you watch. The phone or the fridge door gets out of the way, Mo turns
three-quarters to the camera, brings the item up in his right hand and takes it in three bites —
the food shrinking with each one, crumbs falling, a crunchy munch on every bite and his head
working between them (a drink is a long pull with the head tipped back and a gulp; a loosie is a
drag). Then the hand drops, he holds still for a beat, and the walk takes him back. The HUD bars
ease up to the new values while he chews.

### Item art

Everything Mo can carry has its own small flat illustration — the ramen cup, the can of beans,
the BEC on a roll, the chopped cheese, the tall boy, the halal plate, the CRT, the guitar, the
watch, the State ID, the lease — drawn as inline SVG so it stays sharp at any scale. The same art
is used on the menu boards, the fridge shelves and the inventory tiles.

### The rest of the loop

- **Needs** — energy, hunger, hygiene, stress, morale, dependence, risk. Sleep, eat, shower, work.
  Sleep eases withdrawal instead of compounding it, and the night ends in the **Daily Report**:
  money, energy, hunger, stress, dependence and risk for the day just closed.
- **The job** — Quik-Stop #14, shifts, strikes, calling out, quitting, rehire.
- **Rent and bills** — rent, power, phone; eviction after two missed cycles; power cuts.
- **The phone** — eleven parody apps: Txtr, Shale Pay, LinkedOut, BidBay, iDread, GrubHope,
  Pocket Lint, Landlordly, FeedLove, Blessed+ and Tweaks.
- **The Golden Fellowship** — Addison Octavius, the allowance, the tithe, the pledge.
- **Eleven endings**, from `functional` to `overdose`, `evicted`, `pledged`, `snapped`.

---

## Project layout

```
index.html            page shell, CRT overlay, UI root
styles/main.css       base UI: HUD, phone chassis, threads, menus
styles/ui2.css        skins, message feed, MoPhone apps, menu boards, fridge, report
src/main.js           game orchestrator: loop, state, flow
src/core/             config (all balance values), state, input, audio, save, util
src/render/           retro renderer (affine UVs, vertex snap, dither), textures,
                      heads (skull + wrap face textures), faces (rendered portraits)
src/world/            characters, areas, shops, schedules, 3D world/camera,
                      title (the title performance), eating (the eating animation)
src/systems/          needs, economy, jobs, events, street, fellowship, dialogue, endings
src/ui/               hud, feed (message history), phone, apps (parody app catalog
                      and icons), icons (item art), shopmenu, fridge, threads, modal,
                      menu, themes
scripts/              check-syntax.mjs (parses every module), shot.mjs (Playwright
                      screenshots of the cast/HUD), bake-mo-face.py (reference -> texture)
assets/ref/           Mo's reference sheets (face + full body) — the art-direction anchor
docs/DEVLOG.md        design notes and changelog
```

Balance lives in `src/core/config.js` — costs, rates, wages, stock and thresholds. Gameplay code
reads from `CONFIG` rather than hardcoding numbers.

---

## Notes

- Everything here is fiction. The substances in the game (BLISS, STATIC, MUD, DRIP) are invented
  and described only in mechanical terms — no real-world dosing, sourcing or preparation detail.
- The Golden Fellowship, Addison Octavius, Shale Mobile, Quik-Stop, Kestrel Street, the Civic
  Relief Program and BidBay are original fiction. The phone apps (Txtr, Shale Pay, LinkedOut,
  iDread, GrubHope, Pocket Lint, Landlordly, FeedLove, Blessed+, Tweaks) are parodies with their
  own names and artwork; no real app's logo or trademark is used.
- Visual style is an homage to late-90s console rendering: low internal resolution, affine texture
  mapping, vertex snapping, ordered dithering, fog. No platform assets or trademarks are used.
