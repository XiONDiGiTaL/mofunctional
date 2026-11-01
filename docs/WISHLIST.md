# MO: FUNCTIONAL — Owner's Feature Wish List

Everything the owner has asked for, in one place, with where it stands. Any agent working on the
game reads this before planning, keeps it current, and never marks something done that has not
been built and checked. Status: **done** · **partial** · **todo**.

## The direction (do not lose this)

- Open-ended life sim, late-1990s NYC, dark comedy, PS1 look and sound. No game over: what used
  to end the run is a turning point; the run ends only by the player's choice — or by the one
  ironic exit below.
- Long-term pressure from overlapping systems (rent, dependence, work, relationships,
  opportunities) so Mo cannot comfortably satisfy everything at once. That is the game.
- **The Fellowship is the antagonist, but not evil in the usual sense.** Addison extorts Mo for
  cash. If Mo goes all the way in, it works: he stops using, turns his life around and becomes a
  more-than-functional member of society — and that ends the game. It is *not* the good ending.
  The game is about balancing and maintaining his life despite everything, not being saved by a
  cult. **(done — see README "The Golden Fellowship")**
- All GitHub work is authored by XiØN / XiONDiGiTaL only. No AI attribution anywhere.

## Movement, camera, navigation

| Item | Status |
|---|---|
| Mo stuck walking one way; walking into walls; input leaks | done (725c537) |
| Interior camera erratic / clipping; stable transitions | done (725c537) |
| Discoverable entrances, working doors, no prompt on arrival | done |
| Map synced to the world (street + interiors), minimap | done |
| Touch controls | todo |

## World and places

| Item | Status |
|---|---|
| Quik-Stop #14 fully visitable store (even off-shift) | done |
| Kestrel Bodega, Habib's: menu boards with item art | done |
| Kestrel Clinic: real location, treatment, outpatient course | done |
| Kestrel Park: benches, court, chess, boombox, dancing | done |
| Audit every building for a real purpose | partial |
| Street furniture: ATM, laundromat, more payphone use | todo |
| Environmental storytelling that changes over days (graffiti, trash, posters, clutter) | todo |
| Weather (rain), power cuts, seasonal/neighbourhood events | todo |

## NPCs and events

| Item | Status |
|---|---|
| NPC schedules; Dex out only at night | done |
| Talk prompts follow NPCs; NPCs don't block doors | done |
| Event scheduler: weights, cooldowns, gaps, windows, history | done |
| **Visual** random events: argument, police car, ambulance, musician, robbery, crowd, celebration | partial (street music only) |
| Pedestrians crossing the block; NPC-to-NPC conversations | todo |
| Neighbourhood reputation (beyond per-person trust) | partial |
| NPCs recognise Mo and remember past interactions | partial |

## Economy, phone, possessions

| Item | Status |
|---|---|
| Rent early, receipts, eviction → rehousing, debt | done |
| Rolo: SMS + WAP app ordering, the meet, smile | done |
| Rolo actually appears (wait elsewhere, then meet) | done |
| Dex sells stronger, riskier stock only he has, only at night | done |
| BidBay marketplace: random listings, fluctuating prices, scams, item condition | todo |
| Carry capacity; carried vs stored possessions | partial (fridge storage) |
| Phone as the hub: notices, job offers, marketplace pings, social calendar | partial |
| SMS: correct sender identities and context replies | done |
| No real brand look-alikes (FeedLove uses a heart, not a camera) | done |

## Social life and dating

| Item | Status |
|---|---|
| Stephanie / Melanie / Diana, hearts, flirt, dates, girlfriend, Cheeks, Afterglow | done |
| Gifts, moving in, rent share, household behaviour | done |
| **FeedLove dating**: browse profiles; most women reject Mo; the three answer, swap numbers, become contacts, set up dates | done |
| Live-in partner paths around furniture | todo |
| Relationship events (bad day, disagreement, special occasion) | partial |

## Animation and feedback

| Item | Status |
|---|---|
| Eating, substance use, collapse/fall, dance, handoff smile, high face | done (not yet watched by a human in real time) |
| Visual events with procedural animation | todo |

## Tools

| Item | Status |
|---|---|
| Hidden debug menu (`~`, `Moses`) with stats, money, time, day, NPCs, events, relationships | done |
| Save migration | done (v3) |
