# MO: FUNCTIONAL — Design Bible

**Tagline:** *You don't have to get your life together. You just have to keep it together.*

A single-player, PS1-inspired, dark-comedy life-management simulation. One character,
one week-to-week grind, thirty days, eleven ways for it to end badly (two of which are
almost good).

---

## 1. Pitch

Mo is a functional addict: he has a job, a lease, a phone full of people who want things,
and a habit that quietly rewrites the arithmetic of his week. The game is not about
getting clean in a montage. It is about **scheduling** — the brutal, tiny mathematics of
keeping a life from collapsing on a Tuesday.

The comedy comes from the world: Addison Octavius and his gold-collar cult, Dale and the
Quik-Stop, Chairman the cat, the civic relief office, a city that keeps advertising things
nobody can afford. The mechanics stay straight-faced. The numbers are real and they hurt.

**Tone:** deadpan, specific, humane. Never cruel to the player, often cruel to Mo's
calendar. No moralising, no violence, no real drug information.

---

## 2. Pillars

1. **Time is the antagonist.** Every action costs minutes. The clock is the level design.
2. **Money is a trap, not a score.** The job does not cover the week. The margin comes
   from selling your own furniture, from odd jobs, or from people with agendas.
3. **The body is a system.** Energy, hunger, hygiene, stress, morale. Neglect compounds;
   so does dependence. Nothing is a cosmetic bar.
4. **The phone is the interface.** Not a menu — a device with apps, notifications,
   obligations and bad news.
5. **Comedy in the world, rigour in the systems.** The joke is the situation, never the maths.

---

## 3. Core loop

```
wake → check phone → triage needs → travel → shift / odd job / errand
     → resolve a bill or a person → sleep (or fail to) → repeat
```

Each day is a **budget of ~16 usable hours** and roughly **$15–$25 of unavoidable outflow**
(food, transport, bills amortised). The 8-hour shift occupies half the day and leaves Mo
depleted. This is the squeeze.

---

## 4. Resources

| Resource | Range | Gain | Loss | Failure state |
|---|---|---|---|---|
| Energy | 0–100 | sleep 13/h, food, uppers | awake 3.4/h, work 6.2/h | collapse (4h lost) |
| Hunger | 0–100 | meals (+15…+36) | 3.0/h awake | risk rises, morale falls |
| Hygiene | 0–100 | shower +34 | 1.3/h, work 2.2/h | stress, social events |
| Stress | 0–100 ↑bad | work, arrears, withdrawal | TV, sleep, church, alcohol-free coping | at 52 h above 85 → *snapped* |
| Morale | 0–100 | sleep, food, people, guitar | isolation, withdrawal, debt | ≤1 for 10 h → *empty* |
| Addiction | 0–100 | each dose (+6…+11) | none passively | drives withdrawal & risk |
| Tolerance | 0–100 | each dose | never | blunts effect, raises risk per dose |
| Risk | 0–100 | dosage × tolerance, neglect | rest/food/cleanliness | 100 → *overdose* |
| Withdrawal | 0–100 | time since dose | doses (−38), time | 92 → collapse |

**Overdose is never random.** It is the visible sum of risk: each dose adds risk, and risk
only decays while Mo is fed, rested, clean and not in withdrawal. Neglect makes risk climb
on its own. The player can always see the number.

---

## 5. Economy

### Income
| Source | Amount | Time | Notes |
|---|---|---|---|
| Quik-Stop shift | $86 net | 8 h | Mon–Fri, 3 strikes = fired |
| Odd jobs | $22–$74 | 2–4 h | one of each per day |
| BidBay | 42–200% of value | 0 h + waiting | price high = no sale |
| Fellowship allowance | $55 | 2.5 h (Sunday) | requires attendance |
| CRP food credit | $95/week | 45 min once | food only, recert weekly |
| Dumpster | $2–$9 or goods | 15 min | hygiene cost |

### Outflow
| Bill | Amount | Period |
|---|---|---|
| Rent (Unit 3B) | $420 | 7 days (first due Day 7) |
| Power | $64 | 14 days (first due Day 5) |
| Phone | $35 | 7 days (first due Day 4) |
| Food | $1.40–$5.50 / meal | ~2 meals/day |
| Transport | $6 / shift | — |

**Weekly maths:** +$430 wages − $420 rent − $32 power − $35 phone − $60 food ≈ **−$117**.
The shift alone cannot pay for the life. That gap is the game. Closing it means selling
things (which shrinks the future), working odd jobs (which costs the body), or accepting
money from Addison (which costs the ending).

### BidBay
- List any item except documents, at any price.
- Sale chance: ≤75% of value → 95%, ≤100% → 70%, ≤115% → 42%, ≤135% → 17%, above → 5%.
- Resolution after 7–26 in-game hours. Unsold items come back.
- Sellable inventory at start: CRT TV ($95), guitar ($150), watch ($60), jacket ($45).
- Dex pays 42% instantly, no waiting, no questions.

---

## 6. People

### Mo
Late thirties. White tee, grey-blue jeans, close-cropped hair, moustache and goatee, tired
eyes. Funny in a way that used to work. He is not a victim and not a cautionary tale; he is
a person with a schedule and a problem.

### Addison Octavius — antagonist
Priest and cult leader of **The Golden Fellowship**. White double-breasted suit, gold tie
with a clip, gold pocket square, gold cufflinks, grey hair and beard, theatrical to the
point of menace. He does not threaten. He offers. His weapon is logistics: a bed, a meal,
a role, a tenth.

**Pipeline:** stranger → invited → attendee ($55/service) → tither (10% of all income) →
inner circle (demands) → pledge (**ending**). Each stage feels like relief. The tithe
accrues whether or not the player notices, and unpaid tithe blocks the allowance.

### Supporting cast
- **Rae Vell** — landlord. Tired, decent, documenting everything. The clipboard with only
  Mo's name on it.
- **Dale** — Quik-Stop manager, 54, covers shifts, has ready paperwork.
- **Dex** — the corner. Cash only. Sells the fictional substances and buys valuables cheap.
- **Kev** — coworker. Loud, loyal, has a theory about the freezer.
- **Nia** — Mo's sister. Calls. Waits. Has started lying to their mother.
- **Chairman** — cat. Adopts Mo if allowed. Weekly food cost, morale gain, zero respect.

---

## 7. Content register

**Allowed:** money stress, housing insecurity, addiction as a mechanical system, loneliness,
labour, absurd religion, pet comedy, bodily humour, bureaucratic comedy.

**Not allowed:** real drug names, dosing, procurement advice, withdrawal "hacks",
graphic self-harm, violence, weapons, sexual content, real organisations or people.

All substances (BLISS, STATIC, MUD, DRIP) are invented and exist only as numbers in
`CONFIG.substances`. The phone and the drawer both state this.

---

## 8. Endings

| ID | Trigger | Register |
|---|---|---|
| `overdose` | risk reaches 100 | blunt, quiet, unsentimental |
| `withered` | 4 collapses | medical, transactional |
| `evicted` | 2 missed rent cycles | administrative cruelty |
| `terminated` | fired + broke + behind on rent | the blank schedule |
| `pledge` | sign Addison's pledge | gilded, warm, horrifying |
| `empty` | morale ≤1 for 10 h | flat, dissociative |
| `snapped` | 52 h above 85 stress | comic until it is not |
| `functional` | 30 days, rent current, employed | survival, not a compliment |
| `quiet` | 30 days, rent current, unemployed | unremarkable endurance |
| `steady` | 30 days, addiction ≤42, morale ≥48 | small and real |
| `lucid` | 30 days, addiction ≤22, risk <30, morale ≥55 | the long way around |

Best ending is intentionally hard: it requires a full month of scheduling without leaning
on the drawer, which is exactly what the game has been training the player to do.

---

## 9. Interface principles

- The phone pauses time; it is a respite, not a loophole.
- Every screen answers "what does this cost?" in the same breath as "what does this give?"
- Numbers are always visible; nothing is hidden behind a stat screen.
- Notifications interrupt diegetically — a message arrives whether or not the app is open.

---

## 10. Art direction

Late-90s PlayStation: sub-240p internal resolution, nearest-filtered procedural textures,
affine UV distortion, vertex snapping, wobble, ordered dithering, fog eating the draw
distance, a handful of emissive surfaces doing all the lighting. Characters are box-limbed
rigs with hand-drawn face textures. Animation is exaggerated and slightly wrong on purpose.

**Forbidden:** PBR, bloom, antialiasing, smooth normals, modern UI gradients, photorealism,
mobile-game iconography.

---

## 11. Roadmap (design intent)

1. **m1 (current):** all systems, one neighbourhood, eleven endings.
2. **m2:** recovery chain (clinic, meetings, a sponsor who is worse than the habit),
   clinic costs days and money; second job track; landlord subplot.
3. **m3:** more of the city — pawn shop, plasma-adjacent "donation" clinic (fictional),
   night bus, a second apartment tier.
4. **m4:** audio pass (radio, organ, street beds), localisation extraction, accessibility.
