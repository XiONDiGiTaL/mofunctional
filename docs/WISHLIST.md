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
| The three modelled on the owner's sheet (faces, hair, outfits) | done |
| Twenty app women from the owner's sheet: real faces in HEARTS, 3D models, run-ins on the block, a few open to hooking up (not dating) | done |
| Hugs, a kiss on Mo's cheek, holding hands and walking together | done |
| The three have schedules across the park, Quik-Stop, bodega, Habib's and the street | done |
| LoveLine folded into FeedLove; NextStoop (neighbourhood lore, board, live sightings) on the home screen | done |
| FeedLove: followers/following, a timeline with pictures, typed posts, likes both ways with the three | done |
| Txtr threads per contact; Gus fixed (placement, pose, dialogue); camera over the road and through poles | done |
| 1104 Kestrel walk-up (5 levels, hallway life, Squeak, Stephanie's 5C, roof) | done |
| HardLuck Bet casino app (slots, blackjack, roulette) | done |
| Nia visits with home-cooked meals, earned by how Mo answers her | done |
| The B44 to Ashby Avenue (newsstand, pawn, sax player) and Lucia's restaurant (meals, a date) | done |
| Credits by XiØN, a fiction and real-life drug-use disclaimer | done |
| Dale and the objective check whether Mo is employed | done |
| The lot past the clinic (dice, park east gate) | done |
| More open app women, hers/his place, the clap, accuse, NextStoop warning | done |
| NextStoop POST: own posts, a daily paid gig, a stoop sale | done |
| Laptop (Netscrape): MeTube, Kestrel Underground, DialUpDelights, and every phone app | done |
| TradeHarder stocks and property (1104, the lot; tenants) | done |
| Muggings after dark: pay, run or fight (swing meter); robbed and clinic on a loss | done |
| Amazin' online store, next-day delivery | done |
| Walk across the street at the crosswalks; the parked car moved off the crossing | done |
| HailMary car service: a car that shows up at the curb, destinations, "it's up the road" pushback | done |
| Low-poly vehicle models from the owner's sheet; parked cars searchable at night; traffic that stops and honks, solid | done |
| Shale Pay AutoPay with payment and insufficient-funds texts | done |
| Dice crew at the lot; the couple argue in turns; smokers with smoke; walkers; bench sitter; patrol cars and other visible events | done |
| Meatball the stray: feed, loyalty meter, follows, ally in muggings | done |
| Fire escapes moved off the Quik-Stop and Fellowship signs | done |
| F / Enter / Space confirm the highlighted choice; W/S or arrows move it; 1-9 pick | done |
| Bus stop at the curb by the crosswalk | done |
| Night: the alley pee, the censored stairwell couple | done |
| Park cops at night, searches when high, booking, the 84th Precinct on Ashby | done |
| The payphone: coin return, stash, Dex's night calls | done |
| Dee's Wash & Fold: vending, laundry, change, people; buy it; the back room (PC, laundering into property levels) | done |
| QoL: contextual prompts (key, reason, cycling), opening hours, Today panel + pinned goals, map destinations/route/markers, 1104 floor indicator + directory, notification center, log clear + settings, time-state line, sleep and speed warnings | done |
| Live-in partner paths around furniture (grid pathing in every interior) | done |
| Key remapping, inventory sorting, save-slot details, camera reset key | todo |
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
